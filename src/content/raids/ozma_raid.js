/* =====================================================================
   奥兹玛团本内容（docs/RAID_OZMA.md §5~§7）：精英破防（raid_elite 登记）、18 个领主的机制脚本（raid_mech 的 raidScript）、
   奥兹玛锁血 / 卡赞无敌（领主机制 ozmaLock）、理智值扣减 / 恢复（bus playerHurt；HUD 和第一次归零的小游戏在 ui/raid_ozma.js）。
   规则参数（节点图 / 奖励 / 理智 / 混沌）在 game/raid_ozma.js（服务端也加载那个文件），这里只放客户端内容。
   依赖：regions/ozma.js（DUNGEONS / MON）、game/raid_mech_rt.js（raidScript）、game/raid_elite.js、game/raid_ozma_mech.js（doors 谜题）。
   ===================================================================== */

// ---- 精英：每个区域的门将 / 王座门将各一种破防条件，技能在 regions/ozma.js 的 OZMA_GATEKEEPERS（抬手前冲 / 召唤 / 震地环）----
if (typeof defineRaidElite === 'function') {
  // 毁灭门将：前冲 + 黑焰扇射。抬手时闪光，窗口内命中 = 打断（硬直 + 破防），否则砸出一击【原创】
  defineRaidElite('ozEliteRuin', { name: '毁灭门将', mon: 'ozma_gate_ruin', type: 'counterBreak', p: { every: 9, windup: 2.4, flashAt: 1.5, flashLen: 0.7, punish: 0.25, weakDur: 7, weakMul: 1.6 }, text: '毁灭门将抬手了——闪光时命中它！' });
  // 绝望门将：绝望之球飞向它，连续拦截 4 个才破防，漏球会回血【原创】
  defineRaidElite('ozEliteDespair', { name: '绝望门将', mon: 'ozma_gate_despair', type: 'intercept', p: { every: 8, orbN: 2, travel: 6, need: 4, healPct: 0.05, weakDur: 7 }, text: '绝望之球飞向门将——拦截它们！' });
  // 恐怖门将：背后长出岩壳，打碎全部才吃得到伤害【原创】
  defineRaidElite('ozEliteTerror', { name: '恐怖门将', mon: 'ozma_gate_terror', type: 'breakShell', p: { shells: 3, hits: 4, regen: 20, weakDur: 10 }, text: '恐怖门将被岩壳包住了——先打碎岩壳！' });
  // 埃利诺斯压制者：击杀分身才能压制（击杀 = 倒计时重置，见 raid_ozma.js p2_elerinon.elites）【原创】
  defineRaidElite('ozEliteSuppress', { name: '埃利诺斯压制者', mon: 'ozma_gate_terror', type: 'killClone', p: { cloneN: 3, weakDur: 9 }, text: '打碎分身，压制埃利诺斯！' });
  // 王座门将：更快的破招（阿斯特罗斯 / 奥兹玛前的守门人）【原创】
  defineRaidElite('ozEliteChaos', { name: '王座门将', mon: 'ozma_gate_terror', type: 'counterBreak', p: { every: 7, windup: 2.0, flashAt: 1.2, flashLen: 0.6, punish: 0.35, weakDur: 6, weakMul: 1.7 }, text: '王座门将起手了——闪光窗口更短！' });
}

// ---- 领主脚本（raid_mech.js 头部有字段说明；puzzle 原语见同文件）----
const OZ_CROUCH = (name, o = {}) => ({ use: 'crouch', name, windup: 2.0, hurt: 0.3, ...o });
const OZMA_RAID_SCRIPTS = {
  // —— 毁灭区域 ——
  ruin_path: { intro: { dur: 2.2, say: '毁灭之王卡赞的幻影拦在路口' }, atk: [{ every: [26, 32], first: 16, puzzle: OZ_CROUCH('黑焰横扫') }],
    weak: { at: [0.55], pool: [{ use: 'clear', name: '切断锁链', n: 3, hold: 1, grow: 0, dur: 18, col: '#ff6a3a', label: '锁' }] }, onSolve: { dur: 7, mul: 1.5 }, lines: { intro: '这条路的尽头，只有毁灭。', solve: '锁链……断了？' } },
  ruin_resting: { intro: { dur: 2 }, atk: [{ every: [28, 34], first: 18, puzzle: OZ_CROUCH('沉眠脉冲') }],
    weak: { at: [0.6, 0.3], pool: [{ use: 'dps', name: '打断咏唱', need: 0.04, dur: 10, onSolve: { dur: 6, say: '咏唱被打断了！' } }] }, onSolve: { dur: 6, mul: 1.5 }, onFail: { frac: 0.5, down: true }, lines: { intro: '嘘……别吵醒他。' } },
  ruin_beyond: { intro: { dur: 2.5, say: '贝利亚斯撕开了裂界' }, atk: [{ every: [24, 30], first: 14, puzzle: { use: 'burial', name: '血刃束缚', hits: 9, dur: 6, hurt: 0.3 } }],
    weak: { at: [0.7, 0.4], pool: [{ use: 'clear', name: '关闭裂界', n: 4, hold: 1.5, grow: 4, every: 5, max: 6, dur: 22, col: '#ff5a5a', label: '裂界' }] }, onSolve: { dur: 8, mul: 1.5 }, onFail: { frac: 1, down: true },
    lines: { intro: '越过混沌之门的人，都成了我的猎物。', cast: '裂界，张开！', solve: '裂界……关上了？', low: '燃烧吧——！' } },
  ruin_gladden: { intro: { dur: 2.2 }, atk: [{ every: [30, 36], first: 20, puzzle: OZ_CROUCH('黑羽雨') }],
    weak: { at: [0.65, 0.3], pool: [{ use: 'pads', name: '狂欢符文', n: 4, peek: 5, dur: 18, maxWrong: 3 }] }, onSolve: { dur: 8, mul: 1.5 }, lines: { intro: '来跳舞吧，小老鼠们~', cast: '踩错了可不行哦。' } },
  ruin_corridor: { intro: { dur: 2 }, atk: [{ every: [26, 32], first: 14, puzzle: OZ_CROUCH('长廊炮击') }],
    weak: { at: [0.5, 0.2], pool: [{ use: 'clear', name: '终末封印', n: 2, hold: 2, grow: 0, dur: 20, col: '#c08aff', label: '封印' }] }, onSolve: { dur: 7, mul: 1.5 }, lines: { intro: '亡者回廊的守卫……不会放你们过去。' } },
  // —— 绝望区域 ——
  despair_crossroads: { intro: { dur: 2.2 }, atk: [{ every: [28, 34], first: 18, puzzle: { use: 'burial', name: '绝望标记', hits: 8, dur: 6, hurt: 0.3 } }],
    weak: { at: [0.5], pool: [{ use: 'orbs', name: '绝望之球', elems: ['dark', 'ice', 'light'], dur: 20 }] }, onSolve: { dur: 7, mul: 1.5 }, lines: { intro: '分岔路的每一条，都通向绝望。' } },
  despair_aventus: { intro: { dur: 2 }, atk: [{ every: [24, 30], first: 14, puzzle: OZ_CROUCH('焚城') }],
    weak: { at: [0.6, 0.3], pool: [{ use: 'gem', name: '火种', n: 2, toBoss: true, dur: 24, label: '火种', altarLabel: '阿文图斯' }] }, onSolve: { dur: 8, mul: 1.5 }, lines: { cast: '把火种……带来！' } },
  despair_phylis: { intro: { dur: 2 }, atk: [{ every: [30, 36], first: 20, puzzle: OZ_CROUCH('悲鸣') }],
    weak: { at: [0.5, 0.2], pool: [{ use: 'crystals', name: '悲鸣水晶', n: 6, hits: 2, dur: 18, col: '#9ab0ff' }] }, onSolve: { dur: 8, mul: 1.5 }, lines: { intro: '啊……啊啊啊——' } },
  despair_serha: { intro: { dur: 2 }, atk: [{ every: [26, 32], first: 16, puzzle: OZ_CROUCH('教团审判') }],
    weak: { at: [0.6, 0.25], pool: [{ use: 'heartbeat', name: '混沌之心', need: 4, dur: 20 }] }, onSolve: { dur: 8, mul: 1.5 }, lines: { intro: '赛赫的信徒，会替你们祈祷。' } },
  despair_lunen: { intro: { dur: 2.5, say: '提亚马特从月蚀中现身' }, atk: [{ every: [30, 36], first: 18, puzzle: OZ_CROUCH('月蚀循环') }],
    weak: { at: [0.7, 0.35], pool: [{ use: 'orbs', name: '光暗护盾', elems: ['light', 'dark', 'fire', 'ice'], dur: 22 }, { use: 'swords', name: '月蚀之剑', rounds: 3 }] }, onSolve: { dur: 8, mul: 1.5 }, onFail: { frac: 1, down: true },
    lines: { intro: '光与暗，终将同归于寂。', cast: '月蚀，开始。', solve: '这……不可能。', low: '天空，坠落吧！' } },
  // —— 恐怖区域 ——
  terror_land: { intro: { dur: 2 }, atk: [{ every: [26, 32], first: 16, puzzle: OZ_CROUCH('大地震裂') }],
    weak: { at: [0.5], pool: [{ use: 'dps', name: '地刺牢笼', need: 0.05, dur: 10 }] }, onSolve: { dur: 7, mul: 1.5 }, lines: { intro: '大地，在恐惧中颤抖。' } },
  terror_grauben: { intro: { dur: 2 }, atk: [{ every: [28, 34], first: 18, puzzle: OZ_CROUCH('炮台齐射') }],
    weak: { at: [0.6, 0.3], pool: [{ use: 'crystals', name: '炮台', n: 5, hits: 3, dur: 20, col: '#ffb060' }] }, onSolve: { dur: 8, mul: 1.5 } },
  terror_eldfell: { intro: { dur: 2 }, atk: [{ every: [30, 36], first: 20, puzzle: OZ_CROUCH('灰烬陨落') }],
    weak: { at: [0.55, 0.25], pool: [{ use: 'pads', name: '熔岩点', n: 5, peek: 5, dur: 20, maxWrong: 3 }] }, onSolve: { dur: 8, mul: 1.5 }, lines: { intro: '熔岩……在呼吸。' } },
  terror_martyr: { intro: { dur: 2.5, say: '卡赞披着无敌的神焰降临' }, atk: [{ every: [24, 30], first: 14, puzzle: { use: 'burial', name: '罪火审判', hits: 10, dur: 5, hurt: 0.35 } }, { every: [34, 40], first: 26, puzzle: OZ_CROUCH('神焰爆发') }],
    weak: { at: [0.65, 0.3], pool: [{ use: 'guide', name: '誓约火种', n: 3, toBoss: true, goal: 70, dur: 26, label: '火种', goalLabel: '卡赞' }, { use: 'dps', name: '破除神焰', need: 0.05, dur: 10 }] }, onSolve: { dur: 8, mul: 1.5 }, onFail: { frac: 1, down: true },
    lines: { intro: '吾乃毁灭之王，神焰不灭！', cast: '神焰，燃尽一切！', solve: '神焰……熄灭了……', low: '我不会倒下！' }, ozmaGuard: 'altar' },
  terror_red_altar: { intro: { dur: 2 }, atk: [{ every: [28, 34], first: 18, puzzle: OZ_CROUCH('祭坛献祭') }],
    weak: { at: [0.6, 0.2], pool: [{ use: 'clear', name: '占领祭坛', n: 3, hold: 1.5, grow: 0, dur: 20, col: '#ff4a6a', label: '祭坛' }] }, onSolve: { dur: 8, mul: 1.5 }, lines: { intro: '赤红的乐园，需要新的祭品。' } },
  // —— 阶段 2 ——
  p2_elerinon: { intro: { dur: 2 }, atk: [{ every: [26, 32], first: 12, puzzle: OZ_CROUCH('黑雾连斩') }],
    weak: { at: [0.5], pool: [{ use: 'clear', name: '内心世界', n: 3, hold: 1.5, grow: 4, every: 5, max: 5, dur: 22, col: '#9eb7ff', label: '裂口' }] }, onSolve: { dur: 8, mul: 1.5 }, onFail: { frac: 0.6, down: true }, lines: { intro: '埃利诺斯的黑雾，吞没了你们的名字。' } },
  // 阿斯特罗斯：三扇次元之门（doors，raid_ozma_mech.js）：躲进她最后没穿过的那扇 = 躲过秒杀并使她虚弱；没人躲进 = 灭团【原创】
  p2_armis: { intro: { dur: 2.5, say: '阿斯特罗斯打开了三扇次元之门' }, atk: [{ every: [34, 40], first: 24, puzzle: OZ_CROUCH('王座炮火') }],
    weak: { at: [0.75, 0.5, 0.25], pool: [{ use: 'doors', name: '次元之门', windup: 6, dur: 6.2, peek: 3.2 }] }, onSolve: { dur: 9, mul: 1.6 }, onFail: { frac: 1, down: true, say: '虚空吞没了你们！' },
    lines: { intro: '选一扇门吧，可爱的小虫子们。', cast: '只有一扇门，我没有走过。', solve: '你们……找到了？', low: '真是出乎意料的玩具……' } },
  p2_throne: { intro: { dur: 3, say: '混沌之奥兹玛' }, atk: [{ every: [28, 34], first: 14, puzzle: OZ_CROUCH('混沌审判') }, { every: [40, 46], first: 30, puzzle: { use: 'burial', name: '混沌锁链', hits: 10, dur: 6, hurt: 0.35 } }],
    weak: { at: [0.8, 0.62, 0.3], pool: [{ use: 'orbs', name: '混沌球', elems: ['fire', 'ice', 'light', 'dark'], dur: 22 }, { use: 'clear', name: '混沌领域', n: 4, hold: 1.5, grow: 4, every: 5, max: 6, dur: 24, col: '#c080ff', label: '领域' }] },
    onSolve: { dur: 9, mul: 1.6 }, onFail: { frac: 1, down: true, say: '终焉降临。' }, lines: { intro: '渺小的人类啊，你们的绝望……是我的养分。', cast: '混沌，吞噬一切。', solve: '这点伤害……', low: '一切，归于混沌！' } },
};

// ---- 领主机制 ozmaLock：奥兹玛 50% 锁血（阿斯特罗斯所在图通关前不会再掉）/ 卡赞无敌（赤红乐园祭坛点亮前打不动）----
// 解除条件读规则核心的会话视图：全团增益 ozmaUnlock、钥匙 altar（raidNet.S）；引导 / 没有会话时不锁
if (typeof defineBossMech === 'function') defineBossMech('ozmaLock', { defaults: { floor: 0.5, unlockGbuff: null, unlockKey: null },
  start(m, st) { st.warned = false; },
  update(m, st, p) {
    const S = typeof raidNet !== 'undefined' ? raidNet.S : null;
    const free = !S || S.graph === 'guide' || (p.unlockGbuff && (S.gbuffs || []).some(b => b.id === p.unlockGbuff)) || (p.unlockKey && S.keys && S.keys[p.unlockKey]);
    if (free) { if (st.locked) { st.locked = false; if (typeof msMulSet === 'function') msMulSet(m, 'ozmaLock', null); if (typeof msSay === 'function') msSay(m, '锁链崩断了！', '#ffe070', 15); } return; }
    const fl = p.floor * m.hpMax;
    if (p.floor >= 1) { st.locked = true; if (typeof msMulSet === 'function') msMulSet(m, 'ozmaLock', 0); m.hp = m.hpMax; return; }
    if (m.hp <= fl) {
      m.hp = Math.max(m.hp, Math.ceil(fl)); st.locked = true; if (typeof msMulSet === 'function') msMulSet(m, 'ozmaLock', 0);
      if (!st.warned) { st.warned = true; if (typeof msSay === 'function') msSay(m, '锁血：击败阿斯特罗斯才能继续', '#ff9ae0', 14); if (typeof toastMsg === 'function') toastMsg('奥兹玛进入锁血：去阿斯特罗斯所在的图！', '#ff9ae0'); }
    }
  } });

// 挂载：脚本 → MON[领主].msMechs；锁血 / 无敌 → 对应领主；eliteSpec → 各地图的精英房（defineRegion 不保留这个字段，所以在这里补）
(() => {
  if (typeof DUNGEONS === 'undefined' || typeof MON === 'undefined') return;
  if (typeof OZMA_ELITE_OF !== 'undefined') for (const [id, D] of Object.entries(DUNGEONS)) { if (!id.startsWith('ozma_')) continue; const core = id.slice(5), area = D.ozma && D.ozma.area, spec = OZMA_ELITE_OF[core] || OZMA_ELITE_OF[area]; if (spec) D.eliteSpec = spec; }
  for (const [id, spec] of Object.entries(OZMA_RAID_SCRIPTS)) {
    const D = DUNGEONS['ozma_' + id], kind = D && D.boss && (D.boss.kind || D.boss), M = kind && MON[kind]; if (!M) continue;
    const { ozmaGuard, ...rest } = spec;
    (M.msMechs ??= []).push({ use: 'raidScript', ...rest });
    if (id === 'p2_throne') M.msMechs.push({ use: 'ozmaLock', floor: 0.5, unlockGbuff: 'ozmaUnlock' });
    if (ozmaGuard) M.msMechs.push({ use: 'ozmaLock', floor: 1, unlockKey: ozmaGuard });
  }
})();

// ---- 理智值（docs/RAID_OZMA.md §7）：被领主 / 精英打中扣理智；赛赫的 sanRegen 缓慢恢复；规则核心记账，HUD / 小游戏在 ui/raid_ozma.js ----
const OZMA_SAN = { acc: 0, regenT: 0 };
const ozmaRaidLive = () => typeof raidNet !== 'undefined' && raidNet.S && raidNet.S.raid === 'ozma' && raidNet.ctx && !raidNet.ctx.done && typeof game !== 'undefined' && game.scene === 'dungeon';
if (typeof bus !== 'undefined') bus.on('playerHurt', e => {
  if (!ozmaRaidLive() || !e || !game.player) return;
  // 每次受击按伤害占最大血量的比例扣理智（累积到 ≥1 才上报，避免刷网络）；混沌等级越高扣得越多
  const lv = (raidNet.S.chaos && raidNet.S.chaos.lv) || 1;
  OZMA_SAN.acc += Math.min(12, (e.dmg / Math.max(1, game.player.hpMax)) * 40) * (1 + (lv - 1) * 0.15);
  if (OZMA_SAN.acc >= 1) { const n = -Math.floor(OZMA_SAN.acc); OZMA_SAN.acc += n; if (raidNet.sanity) raidNet.sanity(n); }
});
if (typeof msTicker === 'function') msTicker(dt => {
  if (!ozmaRaidLive()) return;
  const S = raidNet.S, g = (S.gbuffs || []).find(b => b.p && b.p.sanRegen);
  if (!g) return;
  OZMA_SAN.regenT += dt; if (OZMA_SAN.regenT >= 2) { OZMA_SAN.regenT = 0; const me = raidNet.mine && raidNet.mine(); if (me && me.san != null && me.san < 100 + (g.p.sanMax || 0) && raidNet.sanity) raidNet.sanity(g.p.sanRegen); }
});
