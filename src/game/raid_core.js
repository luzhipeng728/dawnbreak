/* =====================================================================
   团本规则核心（RA1）：浏览器、离线单人和服务端共用的同一份纯规则（docs/RAID_PLAN.md §3、§3.7；消息表见 docs/NETWORK.md「团本」）
   - 不碰 DOM / 游戏全局 / 时钟：时间 now（毫秒）一律由参数传入；随机数用会话里带种子的 RNG → 同一串事件在浏览器和 Node 里跑出同样的结果
   - 浏览器：按 src/ORDER 拼进同一个脚本。对外的全局名只有 RAID_DEFS、RAID_CORE、raidInit、raidEvent、raidTick
     （都是 const：和别的文件重名会直接报语法错，不会静默覆盖）
   - 服务端：server/modules/raid.js 的 loadRaidCore() 读这个文件，在 node:vm 的空上下文里跑一遍，取出 RAID_CORE
     （线上部署时要把这个文件放到服务端的 lib/raid_core.js，见 docs/NETWORK.md「团本」）
   - 离线单人（引导模式）：客户端直接在本地调用同一套函数，会话状态存进存档
   会话状态 S 是纯 JSON（可以直接存库 / 存档）；raidEvent / raidTick 会直接修改 S，并把它放在返回值里
     raidInit(raid, members, mode, now, opt?) → S       members = [{ uid, cid, name, cls, job }]，第一个是团长；mode 'normal' | 'guide'
                                                       opt = { sid, seed, guard: { minClear, maxDrop } }
     raidEvent(S, ev, now) → { S, fx, err, ack }        ev = { t, uid, … }（t 见下面的 EV）；err = { code, text } 表示这条事件被拒绝
     raidTick(S, now) → { S, fx }                       每秒一次：阶段限时、倒计时节点、双生窗口、重生、侵蚀、补位切换
     fx = [{ to: [uid…] | 'all', kind, node, p }]      要发给谁的效果（kind 见 docs/NETWORK.md 的 raid:fx）
   其余（RAID_CORE.*）：view(S) 发给客户端的状态、graph(raid, g) 节点图、scale(S, node, n) 数值、canStart、
     limits / consume 每天 / 每周次数、dayNo / weekNo、rollReward 奖励、shift 停机顺延
   ===================================================================== */

// 团本定义（规则参数 + 节点图）。服务端只加载这个文件：凡是影响规则的参数（节点、计时、复活、次数、奖励表）都写在这里；
// RA3 的内容文件只补客户端的东西（节点地下城 dg、领主、美术），不要在别的文件里改规则参数（服务端看不到）。
// 节点字段：
//   name 名字 | type：main 主线 / buff 增益 / timer 倒计时 / order 顺序击杀 / sync 同步击杀 / final 最终合流
//   area 第几层（情况板的列）| pos [x, y] 情况板上的位置（0~1）| need 前置节点（全部通关才开放）
//   solo 必须分头（不能一起进）| together 最终合流（普通模式里在线的人要一起进）| dg 节点地下城 id（RA3 填）| boss 领主 key（RA3 参考）
//   group 顺序 / 同步的分组 | window 双生窗口（秒）| revive 没同步时复活的血量 | diff 双生血量差阈值 | guard 血多一边的受伤倍率
//   timer 倒计时（秒）| repair 通关后修复（秒）| respawn 增益节点重生（秒）| stopWhen 这个节点通关后本节点关闭
//   fx { clear: [...], expire: [...] } 跨节点效果 | cp 主机定时上报存档点（血量 / 阶段）| minClear 最短通关秒数（防作弊，缺省用 guard.minClear）
//   guide：false = 引导图里没有这个节点；对象 = 引导图里覆盖这些字段（比如 type 改成 main）
//   needEnter 有人进过这些节点才开放 | needBoss 这些节点里任意一次挑战到过领主房（客户端报 boss）才开放 | manual 只能被 merge 打开
//   groupLimit 顺序组的共享时限（秒，组里第一次有人进图开始；到点没打完 = 整组重置、重新分配顺序）| runLimit 单次挑战时限（秒，到点踢回营地；kickEro 这时的侵蚀秒数）
//   failKick 本节点的挑战没打完就结束（失败 / 撤退 / 超时）→ 这些节点里的人也被踢回营地 | failReset 同时把这些节点的进度清掉（重新上锁 / 重新开放、它们给的效果撤掉）
//   aura [{ to, every, id, p, max, text }] 本节点没通关期间（开着 / 有人在打）每 every 秒给 to 节点正在进行的挑战叠一层 p（数值 ×层数 ×scale.pen），to 那边换人 / 离开就清零
//   pool 共享血量池（阶段的 pools）| slot + 阶段 rot：按旋转位置决定进哪张图（形态）| enterFx 进节点时立刻生效的效果（to 缺省 = 自己）
//   数值字段可以写 { normal, guide } 按模式取
// 跨节点效果：{ kind: 'buff' | 'groggy', to: 节点, id, p: { dmgTaken, atk, def, ptaken, weak, … }, dur: 秒（0 = 直到 to 通关）, ifBoss 只在 to 那边已到领主房时生效, text }
//   | { kind: 'heal', to: 节点, text } | { kind: 'time', v: ±秒, text } | { kind: 'stack', to, id, steps: [每层的受伤倍率…], dur }（再次触发叠层并刷新时间）
//   | { kind: 'reset', areas: [层…] }（取其中最靠后、已经开放的一层：进度清零、里面的人踢回营地）| { kind: 'rotate' }（阶段 rot 顺时针转一格）
//   | { kind: 'merge', to: 节点, window: 秒, miss: [没共鸣时的效果…] }（共鸣时：同一个血量池的挑战全部结束，打开 to 节点 window 秒）
// 奖励：rewards.cur = 团本货币的物品 key；p1 / p2 = 每张牌 [{ cur: [少, 多] } | { key, n } | { pick: [key…], n } | { table: [[权重, 牌], …] }]，
//   牌上写 gear: true 的是装备（引导模式按 scale.gear 降低权重）；也可以写 rewards.roll(ctx) 整个自己算（RA3）
const RAID_DEFS = {
  // 希洛克攻坚战：完整保留官方节点图（P1 16 张 / P2 15 张图），2 名玩家轮流打（每人算官方的一支小队）。
  // 官方数值来源和取舍见 docs/RAID_SIROCO.md；[QQ] = 国服官方版本页（dnf.qq.com/cp/a20200922versionm），分歧项在那里写了另一种取值。
  // 两人版的比例（scale.normal，数值字段可以写成 nt => 值，nt = 队数）：pen = 跨图惩罚每层的强度（官方 4 队并行：2 队 ×0.5）；“需要并行”的时限（破坏之门共享时限、真理之棺 8 分钟、阶段 40 分钟）写的是两人版的 ×2，按 par(队数) 缩放
  siroco: {
    id: 'siroco', name: '团本 · 无形之希洛克', minLvl: 60, orderMax: 4,
    // 人数档位：引导 1 人 / 两人版（duoMax，每人一支单人队）/ 多队版（minPlayers ~ maxPlayers，每队最多 teamSize 人、最多 maxTeams 队、至少 minTeams 队）
    duoMax: 2, teamSize: 4, minPlayers: 4, minTeams: 2, maxTeams: 4, maxPlayers: 16,
    // 入口窗口的文案 / 门槛（UI 用，服务端不看）：blurb 简介；reqQuest 主线任务 id 的正则源码（最后一步没完成不能进）；reqName 主线名
    blurb: '希洛克的幻界：攻坚地图上分头打节点，互相影响（顺序击杀、增益、倒计时、双生同步），最后一起讨伐希洛克。两个阶段：追逐战 / 讨伐战（两人版 80 分钟 / 引导 40 / 30 分钟；多队版时限按队数缩短）。',
    reqQuest: '^q_si\\d+$', reqName: '希洛克',
    // 书写的时限都是按两人版（2 支队并行）定的；par(队数) = 相对它的倍率（官方 4 队并行 = ×0.5，2 队 = ×1）。只乘“需要并行”的时限：阶段限时 / 顺序组共享时限 / 共享血量时限
    par: nt => nt >= 2 ? 2 / nt : 1,
    limits: { day: 1, week: 2 },
    lives: { normal: nt => 3 * nt, guide: 3 }, perNode: { normal: 6, guide: 4 },   // 全团每阶段的复活次数（项目规则）；每人每张图的复活币上限 = 官方每队每图 6（引导 4）[QQ]
    erosion: { normal: 60, guide: 10 },
    rest: 300, subAfter: 180, subWindow: 90,   // 阶段间等待 5 分钟（团长可提前开始）[QQ]
    guard: { minClear: { normal: 5, guide: 0 }, maxDrop: 0.05 },
    lvl: { node: 62, final: 64 },
    scale: {
      normal: { hp: 1, atk: 1, mech: 1, cur: 1, gear: 1, penalty: true, pen: nt => Math.min(1, nt / 4) },   // 跨图惩罚每层强度 = 队数 / 4（2 队 ×0.5，4 队 ×1）
      guide: { hp: 0.85, atk: 0.85, mech: 0.6, cur: 0.6, gear: 0.6, penalty: false, pen: 0 },
    },
    phases: [
      { id: 1, name: '阻截战', limit: { normal: 4800, guide: 2400 }, goal: ['gate_l', 'gate_r'], nodes: {
        // ---- 法则之境：4 × 破坏之门，按守门人吸入的灵魂数顺序击杀；有人进图就开始共享时限，超时重置并重新分配顺序 [QQ] ----
        law_a: { name: '破坏之门 1', type: 'order', group: 'law', area: 1, pos: [0.12, 0.14], need: [], solo: true, groupLimit: { normal: 600, guide: 0 }, elites: { siEliteGate: { fx: [{ kind: 'gbuff', id: 'gate_down', p: { dmgDealt: 0.05 }, dur: 120, text: '门倒下了：全团伤害 +5%（120 秒）' }], text: '门倒下了：全团伤害 +5%（120 秒）' } }, dg: 'raid_si_law', boss: 'gatekeeper',
          guide: { name: '破坏之门', type: 'main', pos: [0.12, 0.5] } },
        law_b: { name: '破坏之门 2', type: 'order', group: 'law', area: 1, pos: [0.12, 0.38], need: [], solo: true, groupLimit: { normal: 600, guide: 0 }, elites: { siEliteGate: { fx: [{ kind: 'gbuff', id: 'gate_down', p: { dmgDealt: 0.05 }, dur: 120, text: '门倒下了：全团伤害 +5%（120 秒）' }], text: '门倒下了：全团伤害 +5%（120 秒）' } }, dg: 'raid_si_law', boss: 'gatekeeper', guide: false },
        law_c: { name: '破坏之门 3', type: 'order', group: 'law', area: 1, pos: [0.12, 0.62], need: [], solo: true, groupLimit: { normal: 600, guide: 0 }, elites: { siEliteGate: { fx: [{ kind: 'gbuff', id: 'gate_down', p: { dmgDealt: 0.05 }, dur: 120, text: '门倒下了：全团伤害 +5%（120 秒）' }], text: '门倒下了：全团伤害 +5%（120 秒）' } }, dg: 'raid_si_law', boss: 'gatekeeper', guide: false },
        law_d: { name: '破坏之门 4', type: 'order', group: 'law', area: 1, pos: [0.12, 0.86], need: [], solo: true, groupLimit: { normal: 600, guide: 0 }, elites: { siEliteGate: { fx: [{ kind: 'gbuff', id: 'gate_down', p: { dmgDealt: 0.05 }, dur: 120, text: '门倒下了：全团伤害 +5%（120 秒）' }], text: '门倒下了：全团伤害 +5%（120 秒）' } }, dg: 'raid_si_law', boss: 'gatekeeper', guide: false },
        // ---- 知性之境：进入梦幻之黎明后另外 3 张开放；黎明失败 / 撤退 / 超时 → 其余 3 张里的人被踢回营地 [QQ]；黎明单独限时 7 分钟 [233-黎] ----
        wit_dawn: { name: '梦幻之黎明', type: 'main', area: 2, pos: [0.37, 0.14], need: ['law_a', 'law_b', 'law_c', 'law_d'], runLimit: { normal: 420, guide: 0 },
          failKick: ['wit_night', 'wit_phantom', 'wit_day'], failReset: ['wit_phantom'], elites: { siEliteMaid: { fx: [], text: '侍女被打断倒下了' } }, dg: 'raid_si_dawn', boss: 'haniel' },
        // 未通关期间每 30 秒叠一层（进了黎明才开始算，离开就清零）：哈妮尔攻 / 防 +10%（最多 10 层）、幻影之界视野遮挡 20 秒 [QQ]；重生 1:30 [QQ]
        wit_night: { name: '噩梦之夜', type: 'buff', area: 2, pos: [0.37, 0.38], need: ['law_a', 'law_b', 'law_c', 'law_d'], needEnter: ['wit_dawn'], solo: true, respawn: 90, stopWhen: 'wit_dawn', dg: 'raid_si_night', boss: 'lena',
          aura: [{ to: 'wit_dawn', every: 30, id: 'night_haniel', p: { atk: 0.1, def: 0.1 }, max: 10, text: '噩梦之夜未通关：哈妮尔的攻击 / 防御提升' },
            { to: 'wit_phantom', every: 30, id: 'night_blind', p: { blind: 20 }, max: 99, text: '噩梦之夜未通关：视野被遮挡 20 秒' }], guide: false },
        // 通关：黎明伤害 +100%，只要黎明的队伍不撤退就一直保持（不重生）[91-界][DFO]；未通关：黎明高血量小怪、夜黑色旋风、昼防御 −25%/层（最多 4 层）[91-界][NAMU-WIT]
        wit_phantom: { name: '幻影之界', type: 'buff', area: 2, pos: [0.37, 0.62], need: ['law_a', 'law_b', 'law_c', 'law_d'], needEnter: ['wit_dawn'], solo: true, respawn: 0, stopWhen: 'wit_dawn', elites: { siEliteKula: { fx: [], text: '崔拉倒下了' }, siEliteTanna: { fx: [], text: '昙娜倒下了' } }, dg: 'raid_si_phantom', boss: 'kulaTanna',
          aura: [{ to: 'wit_dawn', every: 30, id: 'phantom_adds', p: { adds: 'siRaidMob_phantomAdd', n: 2 }, max: 99, text: '幻影之界未通关：黎明出现高血量的幻影' },
            { to: 'wit_night', every: 30, id: 'phantom_whirl', p: { whirl: 1 }, max: 99, text: '幻影之界未通关：噩梦之夜出现黑色旋风' },
            { to: 'wit_day', every: 30, id: 'phantom_def', p: { ptaken: 0.25 }, max: 4, text: '幻影之界未通关：防御下降' }],
          fx: { clear: [{ kind: 'buff', to: 'wit_dawn', id: 'phantom_bless', p: { dmgTaken: 2 }, dur: 0, text: '幻影之界通关：梦幻之黎明伤害 +100%（黎明的队伍不撤退就一直有效）' }] }, guide: false },
        // 未通关：每 30 秒黎明召唤玄武、幻影之界召唤伪装者 [QQ]；重生 1 分钟 [QQ]
        wit_day: { name: '归还之昼', type: 'buff', area: 2, pos: [0.37, 0.86], need: ['law_a', 'law_b', 'law_c', 'law_d'], needEnter: ['wit_dawn'], solo: true, respawn: 60, stopWhen: 'wit_dawn', dg: 'raid_si_day', boss: 'myungho',
          aura: [{ to: 'wit_dawn', every: 30, id: 'day_genbu', p: { adds: 'siRaidMob_genbu', n: 1 }, max: 99, text: '归还之昼未通关：黎明召唤了玄武' },
            { to: 'wit_phantom', every: 30, id: 'day_mimic', p: { adds: 'siRaidMob_disguiser', n: 2 }, max: 99, text: '归还之昼未通关：幻影之界出现伪装者' }], guide: false },
        // ---- 苦难之境Ⅰ：记忆的碎片 + 碎片的记忆都要通关；痛苦之镜 ×2 进入本层就开始各 5 分钟倒计时，任意一面到 0 = 重置当前层（Ⅰ 或 Ⅱ）的进度，时间不退 [QQ][YW-镜] ----
        pain_mem: { name: '记忆的碎片', type: 'main', area: 3, pos: [0.62, 0.14], need: ['wit_dawn'], elites: { siEliteDevour: { fx: [{ kind: 'gbuff', id: 'devour_down', p: { dmgDealt: 0.05 }, dur: 120, text: '吞噬者倒下了：全团伤害 +5%（120 秒）' }], text: '吞噬者倒下了：全团伤害 +5%（120 秒）' } }, dg: 'raid_si_memory', boss: 'gusty' },
        pain_mem2: { name: '碎片的记忆', type: 'main', area: 3, pos: [0.62, 0.38], need: ['wit_dawn'], elites: { siEliteDevour: { fx: [{ kind: 'gbuff', id: 'devour_down', p: { dmgDealt: 0.05 }, dur: 120, text: '吞噬者倒下了：全团伤害 +5%（120 秒）' }], text: '吞噬者倒下了：全团伤害 +5%（120 秒）' } }, dg: 'raid_si_memory', boss: 'gusty', guide: false },
        pain_mirror: { name: '痛苦之镜 1', type: 'timer', area: 3, pos: [0.62, 0.62], need: ['wit_dawn'], solo: true, timer: 300, repair: 90, elites: { siEliteDevour: { fx: [{ kind: 'gbuff', id: 'devour_down', p: { dmgDealt: 0.05 }, dur: 120, text: '吞噬者倒下了：全团伤害 +5%（120 秒）' }], text: '吞噬者倒下了：全团伤害 +5%（120 秒）' } }, dg: 'raid_si_mirror', boss: 'grumi',
          fx: { expire: [{ kind: 'reset', areas: [3, 4], text: '痛苦之镜没压住：苦难之境的进度重置了（时间不退）' }] }, guide: false },
        pain_mirror2: { name: '痛苦之镜 2', type: 'timer', area: 3, pos: [0.62, 0.86], need: ['wit_dawn'], solo: true, timer: 300, repair: 90, elites: { siEliteDevour: { fx: [{ kind: 'gbuff', id: 'devour_down', p: { dmgDealt: 0.05 }, dur: 120, text: '吞噬者倒下了：全团伤害 +5%（120 秒）' }], text: '吞噬者倒下了：全团伤害 +5%（120 秒）' } }, dg: 'raid_si_mirror', boss: 'grumi',
          fx: { expire: [{ kind: 'reset', areas: [3, 4], text: '痛苦之镜没压住：苦难之境的进度重置了（时间不退）' }] }, guide: false },
        // ---- 苦难之境Ⅱ：无形之门 ×2 各打各的（没有同时击杀窗口），两扇都通关 = 阻截完成；门的队伍到领主房 → 关联的幻影之城开放 [QQ] ----
        gate_l: { name: '无形之门 1', type: 'main', area: 4, pos: [0.87, 0.14], need: ['pain_mem', 'pain_mem2'], solo: true, failKick: ['castle_l'], failReset: ['castle_l'], elites: { siEliteWatcher: { fx: [], text: '凝视者倒下了' } }, dg: 'raid_si_gate_l', boss: 'vita',
          guide: { name: '无形之门', type: 'main', pos: [0.87, 0.5], elites: { siEliteWatcher: { fx: [], text: '凝视者倒下了' } }, dg: 'raid_si_gate_duo' } },
        gate_r: { name: '无形之门 2', type: 'main', area: 4, pos: [0.87, 0.38], need: ['pain_mem', 'pain_mem2'], solo: true, failKick: ['castle_r'], failReset: ['castle_r'], elites: { siEliteWatcher: { fx: [], text: '凝视者倒下了' } }, dg: 'raid_si_gate_r', boss: 'nex', guide: false },
        // 幻影之城 / 城之幻影：每通关一次，关联的门伤害 +80% / 110% / 140% / 170% / 200%（60 秒内再通关叠层并刷新）[QQ]（另一说：+40%/层、加给两扇门 [YW-城]）
        castle_l: { name: '幻影之城', type: 'buff', area: 4, pos: [0.87, 0.62], need: [], needBoss: ['gate_l'], solo: true, respawn: 10, stopWhen: 'gate_l', dg: 'raid_si_castle', boss: 'rodos',
          fx: { clear: [{ kind: 'stack', to: 'gate_l', id: 'castle_l', steps: [1.8, 2.1, 2.4, 2.7, 3], dur: 60, text: '幻影之城通关：无形之门 1 的伤害提升' }] }, guide: false },
        castle_r: { name: '城之幻影', type: 'buff', area: 4, pos: [0.87, 0.86], need: [], needBoss: ['gate_r'], solo: true, respawn: 10, stopWhen: 'gate_r', dg: 'raid_si_castle', boss: 'rodos',
          fx: { clear: [{ kind: 'stack', to: 'gate_r', id: 'castle_r', steps: [1.8, 2.1, 2.4, 2.7, 3], dur: 60, text: '城之幻影通关：无形之门 2 的伤害提升' }] }, guide: false },
      } },
      { id: 2, name: '讨伐战', limit: { normal: 4800, guide: 1800 }, goal: ['truth_a', 'truth_b', 'truth_c', 'coffin'],
        rot: { pool: 'truth', forms: ['基里', '莱斯特', '拉维茜'], dgs: ['raid_si_truth_g', 'raid_si_truth_l', 'raid_si_truth_v'], resonance: 0 },
        pools: { truth: { limit: { normal: 960, guide: 0 }, name: '希洛克' } },   // 真理的意识之棺共享血量；首次进图起 8 分钟（×2）没打完 = 攻坚失败 [QQ]
        nodes: {
        // ---- 第 3 界：4 × 无欲之棺，顺序不限、不重生；领主每次进图随机房间 [QQ] ----
        sub_a: { name: '无欲之棺 1', type: 'main', area: 1, pos: [0.12, 0.14], need: [], dg: 'raid_si_sub', boss: 'siroNightmare', guide: { name: '无欲之棺', pos: [0.12, 0.5] } },
        sub_b: { name: '无欲之棺 2', type: 'main', area: 1, pos: [0.12, 0.38], need: [], dg: 'raid_si_sub', boss: 'siroNightmare', guide: false },
        sub_c: { name: '无欲之棺 3', type: 'main', area: 1, pos: [0.12, 0.62], need: [], dg: 'raid_si_sub', boss: 'siroNightmare', guide: false },
        sub_d: { name: '无欲之棺 4', type: 'main', area: 1, pos: [0.12, 0.86], need: [], dg: 'raid_si_sub', boss: 'siroNightmare', guide: false },
        // ---- 第 2 界：扭曲的无欲之棺通关 → 关联意识之棺的希洛克虚弱（那边的队伍要在领主房里才有效）约 10 秒；扭曲重生 1:30 [QQ][3DM-意][NAMU-C32] ----
        con_hall: { name: '意识之棺 1', type: 'main', area: 2, pos: [0.42, 0.14], need: ['sub_a', 'sub_b', 'sub_c', 'sub_d'], dg: 'raid_si_con', boss: 'siroPhantom', guide: { name: '意识之棺', pos: [0.42, 0.5] } },
        con_mut: { name: '扭曲的无欲之棺 1', type: 'buff', area: 2, pos: [0.42, 0.38], need: ['sub_a', 'sub_b', 'sub_c', 'sub_d'], solo: true, respawn: 90, stopWhen: 'con_hall', dg: 'raid_si_mutant', boss: 'crone',
          fx: { clear: [{ kind: 'groggy', to: 'con_hall', id: 'con_weak', ifBoss: true, p: { weak: 1 }, dur: 10, text: '“啊！我的结界？”——意识之棺 1 的希洛克虚弱了 10 秒' }] }, guide: false },
        con_hall2: { name: '意识之棺 2', type: 'main', area: 2, pos: [0.42, 0.62], need: ['sub_a', 'sub_b', 'sub_c', 'sub_d'], dg: 'raid_si_con', boss: 'siroPhantom', guide: false },
        con_mut2: { name: '扭曲的无欲之棺 2', type: 'buff', area: 2, pos: [0.42, 0.86], need: ['sub_a', 'sub_b', 'sub_c', 'sub_d'], solo: true, respawn: 90, stopWhen: 'con_hall2', dg: 'raid_si_mutant', boss: 'crone',
          fx: { clear: [{ kind: 'groggy', to: 'con_hall2', id: 'con_weak2', ifBoss: true, p: { weak: 1 }, dur: 10, text: '“啊！我的结界？”——意识之棺 2 的希洛克虚弱了 10 秒' }] }, guide: false },
        // ---- 第 1 界：真理的意识之棺 ×3 共享血量、形态随旋转变化；有人在真理之棺遇到希洛克后否定 / 压抑 / 忘却开放 [QQ] ----
        truth_a: { name: '真理的意识之棺 1', type: 'main', area: 3, pos: [0.7, 0.14], need: ['con_hall', 'con_hall2'], pool: 'truth', slot: 0, dg: 'raid_si_truth_g', boss: 'sirocoForm', guide: false },
        truth_b: { name: '真理的意识之棺 2', type: 'main', area: 3, pos: [0.7, 0.38], need: ['con_hall', 'con_hall2'], pool: 'truth', slot: 1, dg: 'raid_si_truth_l', boss: 'sirocoForm', guide: false },
        truth_c: { name: '真理的意识之棺 3', type: 'main', area: 3, pos: [0.7, 0.62], need: ['con_hall', 'con_hall2'], pool: 'truth', slot: 2, dg: 'raid_si_truth_v', boss: 'sirocoForm', guide: false },
        // 否定：从遇到希洛克起 5 分钟，到点没通关 = 第 1 界整体初始化 [QQ]（另一说：退回第 3 界 [PKVS-P2][NAMU][DFO]）；重生 2:30 [NAMU]
        deny: { name: '无欲之棺：否定', type: 'timer', area: 3, pos: [0.92, 0.14], need: [], needBoss: ['truth_a', 'truth_b', 'truth_c'], solo: true, timer: 300, repair: 150, dg: 'raid_si_deny', boss: 'nightmare2',
          fx: { expire: [{ kind: 'reset', areas: [3], text: '否定没压住：第 1 界整体初始化（共享血量回满）' }] }, guide: false },
        // 压抑：通关一次真理之棺顺时针转 120°（基里 → 莱斯特 → 拉维茜），重生 30 秒 [QQ][NAMU-C1]
        suppress: { name: '无欲之棺：压抑', type: 'buff', area: 3, pos: [0.92, 0.38], need: [], needBoss: ['truth_a', 'truth_b', 'truth_c'], solo: true, respawn: 30, dg: 'raid_si_suppress', boss: 'kain',
          fx: { clear: [{ kind: 'rotate', text: '压抑通关：真理的意识之棺顺时针旋转了 120°' }] }, guide: false },
        // 忘却：共鸣时击杀卢克西 → 真理之棺合并为阴影之棺；没共鸣 = 卢克西逃走（只给真理之棺 30 秒增伤 【存疑】[SR-P2]）；时限 5 分钟、重生 1 分钟 [NAMU-C1][QQ]
        forget: { name: '无欲之棺：忘却', type: 'buff', area: 3, pos: [0.92, 0.62], need: [], needBoss: ['truth_a', 'truth_b', 'truth_c'], solo: true, respawn: 60, runLimit: { normal: 300, guide: 0 }, dg: 'raid_si_forget', boss: 'luxi',
          fx: { clear: [{ kind: 'merge', to: 'coffin', window: 60, text: '共鸣！真理的意识之棺合并成了阴影之棺：60 秒内一起进去',
            miss: [{ kind: 'buff', to: 'truth_a', id: 'luxi_miss', p: { dmgTaken: 1.3 }, dur: 30 }, { kind: 'buff', to: 'truth_b', id: 'luxi_miss', p: { dmgTaken: 1.3 }, dur: 30 }, { kind: 'buff', to: 'truth_c', id: 'luxi_miss', p: { dmgTaken: 1.3 }, dur: 30, text: '没有共鸣：卢克西逃走了（真理之棺受伤 +30%，30 秒）' }] }] }, guide: false },
        // 阴影之棺：合并后才开；进去立刻虚弱 30 秒 [QQ]（另一说 25 秒 [NAMU][SR-P2]），+3 秒缓冲后全员送回等待室、侵蚀 150 秒，伤害算进共享血量 [NAMU-C1]
        coffin: { name: '阴影之棺', type: 'final', area: 3, pos: [0.7, 0.86], need: [], manual: true, together: true, pool: 'truth', runLimit: { normal: 33, guide: 0 }, kickEro: 150,
          enterFx: [{ kind: 'groggy', id: 'shadow_weak', p: { weak: 1, dmgTaken: 1 }, dur: 30, text: '阴影之棺：希洛克虚弱 30 秒！' }], dg: 'raid_si_shadow', boss: 'siroco',
          guide: { name: '真理的意识之棺', pos: [0.8, 0.5], need: ['con_hall'], manual: false, pool: null, runLimit: null, kickEro: null, enterFx: null, cp: true, dg: 'raid_si_coffin' } },
      } },
    ],
    rewards: { cur: 'raid_petal', p1: [{ cur: [3, 4] }, { key: 'raid_immaterial', n: [1, 2] }], p2: [{ cur: [12, 16] }, { table: [[82, { key: 'raid_immaterial', n: [2, 4] }], [18, { pick: ['raid_si_immateriality_1', 'raid_si_immateriality_2', 'raid_si_immateriality_3', 'raid_si_immateriality_4', 'raid_si_immateriality_5', 'raid_si_subconscious_1', 'raid_si_subconscious_2', 'raid_si_subconscious_3', 'raid_si_subconscious_4', 'raid_si_subconscious_5', 'raid_si_phantasm_1', 'raid_si_phantasm_2', 'raid_si_phantasm_3', 'raid_si_phantasm_4', 'raid_si_phantasm_5'], n: 1, gear: true }]] }] },
  },
};

const RAID_CORE = (() => {
  const VER = 2, DAY = 86400000, RESET = 6 * 3600000, BJ = 480;
  const LIVE = { lobby: 1, routes: 1, rest: 1, final: 1 };
  // 数值表缺省（团本没写 scale 时用）。表里的数值字段可以是 nt => 值（nt = 这场的队数）：见 scaleOf
  const SCALE = { normal: { hp: 1, atk: 1, mech: 1, cur: 1, gear: 1, penalty: true, pen: 1 }, guide: { hp: 0.85, atk: 0.85, mech: 0.6, cur: 0.6, gear: 0.6, penalty: false, pen: 0 } };
  // 多队版每队的颜色（情况板 / 标记 / 队员列表按队着色）
  const TEAM_COLORS = Object.freeze(['#ff6b6b', '#5aa9ff', '#6bd66b', '#ffd24a', '#c58bff', '#ff9a3c', '#4ad6c8', '#ff7ac6']);
  // 官方组队拾取规则。`owner` 是掉落归属（击杀者 / 来源队员），`leader` 是队长分配，
  // `random` 是在线队员随机分配，`auction` 先进入竞拍池、由队员竞价后结算。
  // 规则核心不碰 UI / 网络，普通地下城和团本都可以复用这套纯函数。
  const LOOT_MODES = Object.freeze(['owner', 'leader', 'random', 'auction']);
  // DFO 的竞拍钱包上限是角色金币携带上限；本项目的邮件服务同样以 2e9 为单封上限。
  // 竞拍金额在出价时进入托管，超价后按官方规则退回钱包，溢出携带上限的整笔退回邮件。
  const AUCTION_GOLD_CAP = 2_000_000_000, AUCTION_FEE_RATE = 0.05;
  // 追逐战只选一张，讨伐战选两张；服务端规则也校验这个数量。
  const flipLimit = phase => Number(phase) === 1 ? 1 : 2;
  const graphs = {};
  const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
  const defOf = raid => own(RAID_DEFS, raid) ? RAID_DEFS[raid] : null;

  // 节点图：按模式展开（引导图去掉 guide:false 的节点、用 guide 对象覆盖字段），前置里指向不存在节点的去掉
  function graph(raid, g) {
    const D = defOf(raid); if (!D) return null;
    const k = raid + ':' + g, old = graphs[k];
    if (old && old.D === D) return old;
    const out = { D, phases: D.phases.map(P => {
      const nodes = {};
      for (const id of Object.keys(P.nodes)) {
        const n = P.nodes[id];
        if (g === 'guide' && n.guide === false) continue;
        const x = Object.assign({ id }, n, g === 'guide' && n.guide ? n.guide : null);
        delete x.guide;
        nodes[id] = x;
      }
      for (const id of Object.keys(nodes)) for (const k of ['need', 'needEnter', 'needBoss', 'failKick', 'failReset']) nodes[id][k] = (nodes[id][k] || []).filter(x => nodes[x]);
      return { id: P.id, name: P.name, limit: P.limit, goal: P.goal.filter(x => nodes[x]), nodes, rot: P.rot && Object.values(nodes).some(n => n.pool === P.rot.pool) ? P.rot : null, pools: P.pools || {} };
    }) };
    graphs[k] = out;
    return out;
  }

  const def = S => RAID_DEFS[S.raid];
  const phaseOf = S => { const G = graph(S.raid, S.graph); return G && S.phase >= 0 ? G.phases[S.phase] : null; };
  const nodeOf = (S, id) => { const P = phaseOf(S); return P && typeof id === 'string' && Object.prototype.hasOwnProperty.call(P.nodes, id) ? P.nodes[id] : null; };
  const mem = (S, uid) => S.members.find(m => m.uid === uid) || null;
  const act = S => S.members.filter(m => !m.left);
  // 取值：{ normal, guide } 按模式取；函数 (队数, S) => 值 按这场的队数取（规则参数随队数缩放，不写死 ×2 / ×0.5）
  const byMode = (v, S) => { if (v && typeof v === 'object') v = v[S.mode] ?? v.normal; return typeof v === 'function' ? v(S.nTeams || 1, S) : v; };
  // 需要并行的时限（阶段限时 / 顺序组共享时限 / 共享血量时限）按 def.par(队数) 缩放；只在普通图（多人）里生效
  const tmul = S => { const D = def(S); return S.graph === 'normal' && typeof D.par === 'function' ? D.par(S.nTeams || 1) : 1; };
  const tlim = (S, v) => { const x = byMode(v, S); return x ? Math.round(x * tmul(S)) : x; };
  function scaleOf(S) {
    const D = def(S), tab = D.scale || SCALE, T = tab[S.mode] || tab.normal || SCALE.normal, nt = S.nTeams || 1, o = {};
    for (const k of Object.keys(T)) o[k] = typeof T[k] === 'function' ? T[k](nt, S) : T[k];
    return o;
  }
  // 人数上限：多人普通版按 maxPlayers，否则两人版 duoMax（缺省 2）
  const duoCap = D => D.duoMax || Math.min(D.maxPlayers || 2, 2);
  const capacity = S => { const D = def(S); return S.tier === 'team' ? (D.maxPlayers || duoCap(D)) : duoCap(D); };
  const push = (o, to, kind, node, p) => { o.fx.push({ to, kind, node: node || null, p: p || null }); };
  const note = (o, to, text, node) => push(o, to, 'note', node, { text });
  const fail = (o, code, text) => { o.err = { code, text }; return o; };
  const runners = (S, id) => { const N = S.nodes[id], R = N && N.run ? S.runs[N.run] : null; return R && !R.end ? R.by.slice() : []; };
  const names = (S, ids) => ids.map(u => (mem(S, u) || {}).name || '队友').join('、');
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h | 0; }
  function rnd(S) {
    let t = (S.rs = (S.rs + 0x6D2B79F5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function addMember(S, m) {
    S.members.push({ uid: m.uid, cid: String(m.cid || ''), name: String(m.name || ''), cls: m.cls || null, job: m.job || null,
      // gold / vaultGold 只用于纯规则和主机权威的竞拍结算，不会从 view() 暴露给其他队员。
      gold: Number.isFinite(Number(m.gold)) ? Math.max(0, Math.floor(Number(m.gold))) : null,
      vaultGold: Number.isFinite(Number(m.vaultGold)) ? Math.max(0, Math.floor(Number(m.vaultGold))) : 0,
      goldCap: Number.isFinite(Number(m.goldCap)) ? Math.min(AUCTION_GOLD_CAP, Math.max(1, Math.floor(Number(m.goldCap)))) : AUCTION_GOLD_CAP,
      // team：所在队（-1 = 还没分队，开始时按团长分的 / 同一个队伍（party）优先凑一队 / 自动补齐）；party：来自哪个队伍（服务端传，只用来自动分队）
      team: Number.isInteger(m.team) ? m.team : -1, party: m.party == null ? null : String(m.party), san: null, sanZ: 0,
      ready: false, online: m.online !== false, offAt: 0, at: 'camp', ero: 0, left: false, rw: true });
  }
  function init(raid, members, mode, now, opt) {
    opt = opt || {};
    const D = defOf(raid); if (!D) throw new Error('没有这个团本：' + raid);
    mode = mode === 'guide' ? 'guide' : 'normal';
    // 人数档位 tier：guide 引导（1 人）/ duo 两人版（每人一支单人队）/ team 多队版（opt.team：≥ minPlayers 人、分成多队）
    const tier = mode === 'guide' ? 'guide' : opt.team && (D.maxPlayers || 0) > duoCap(D) ? 'team' : 'duo';
    const S = { v: VER, sid: String(opt.sid || ''), raid, mode, graph: mode, tier, nTeams: tier === 'guide' ? 1 : tier === 'duo' ? 2 : 0, teams: [], keys: {}, gbuffs: [],
      chaos: D.chaos ? { lv: 1, max: D.chaos.max || 3 } : null, st: 'lobby', phase: -1, leader: members[0].uid,
      created: now, started: 0, ended: 0, why: null, phaseT0: 0, deadline: 0, restUntil: 0, lives: 0, sub: false,
      members: [], nodes: {}, buffs: [], win: {}, cp: {}, marks: {}, rev: {}, runs: {}, runSeq: 0,
      rs: opt.seed != null ? opt.seed | 0 : hash(String(opt.sid || '') + ':' + now), res: { phases: [], used: {} }, stats: { deaths: 0, penalties: 0 },
      // 翻牌和拾取分配是会话状态的一部分：页面刷新 / 服务端重启后仍然锁在结算阶段，
      // 不能在玩家边走边打时重复领取。历史存档缺字段时由 ensureMeta 补齐。
      flip: { state: 'none', phase: 0, openedAt: 0, closedAt: 0, cards: {} },
      loot: { mode: LOOT_MODES.includes(opt.lootMode) ? opt.lootMode : 'owner', seq: 0, offers: {}, history: [], wallets: {} },
      guard: Object.assign({}, D.guard, opt.guard || {}) };
    for (const m of members) addMember(S, m);
    if (D.sanity) for (const m of S.members) m.san = D.sanity.max || 100;
    for (const m of S.members) {
      const w = opt.wallets && (opt.wallets[m.uid] || opt.wallets[String(m.uid)]) || {};
      S.loot.wallets[String(m.uid)] = {
        gold: Number.isFinite(Number(w.gold)) ? Math.max(0, Math.floor(Number(w.gold))) : (m.gold == null ? AUCTION_GOLD_CAP : m.gold),
        vault: Number.isFinite(Number(w.vault)) ? Math.max(0, Math.floor(Number(w.vault))) : m.vaultGold,
        cap: Number.isFinite(Number(w.cap)) ? Math.min(AUCTION_GOLD_CAP, Math.max(1, Math.floor(Number(w.cap)))) : m.goldCap,
        mail: Array.isArray(w.mail) ? w.mail.slice() : [],
      };
    }
    S.members[0].ready = true;
    return S;
  }

  function ensureMeta(S) {
    if (!S.flip || typeof S.flip !== 'object') S.flip = { state: 'none', phase: 0, openedAt: 0, closedAt: 0, cards: {} };
    S.flip.state ||= 'none'; S.flip.phase = S.flip.phase | 0; S.flip.openedAt ||= 0; S.flip.closedAt ||= 0; S.flip.cards ||= {};
    if (!S.loot || typeof S.loot !== 'object') S.loot = { mode: 'owner', seq: 0, offers: {}, history: [], wallets: {} };
    if (!LOOT_MODES.includes(S.loot.mode)) S.loot.mode = 'owner';
    S.loot.seq = S.loot.seq | 0; S.loot.offers ||= {}; S.loot.history ||= []; S.loot.wallets ||= {};
    // 多队字段（旧会话没有：按两人版 / 引导补齐）
    if (!S.tier) S.tier = S.mode === 'guide' ? 'guide' : 'duo';
    if (S.nTeams == null) S.nTeams = S.tier === 'guide' || (S.st !== 'lobby' && S.graph === 'guide') ? 1 : 2;
    if (!Array.isArray(S.teams)) S.teams = [];
    S.keys ||= {}; S.gbuffs ||= [];
    if (S.chaos === undefined) S.chaos = null;
    const started = S.st !== 'lobby';
    if (started && !S.teams.length && S.members.length) {
      const per = S.graph === 'guide' ? [S.members.map(m => m.uid)] : S.members.map(m => [m.uid]);
      S.teams = per.map((u, i) => ({ id: i, members: u }));
    }
    S.members.forEach((m, i) => { if (m.team === undefined) m.team = started ? (S.graph === 'guide' ? 0 : i) : -1; if (m.party === undefined) m.party = null; if (m.san === undefined) { m.san = null; m.sanZ = 0; } });
    for (const m of S.members || []) {
      const k = String(m.uid), w = S.loot.wallets[k] || {};
      w.gold = Number.isFinite(Number(w.gold)) ? Math.max(0, Math.floor(Number(w.gold))) : (m.gold == null ? AUCTION_GOLD_CAP : Math.max(0, Math.floor(Number(m.gold))));
      w.vault = Number.isFinite(Number(w.vault)) ? Math.max(0, Math.floor(Number(w.vault))) : Math.max(0, Math.floor(Number(m.vaultGold) || 0));
      w.cap = Number.isFinite(Number(w.cap)) ? Math.min(AUCTION_GOLD_CAP, Math.max(1, Math.floor(Number(w.cap)))) : Math.min(AUCTION_GOLD_CAP, Math.max(1, Math.floor(Number(m.goldCap) || AUCTION_GOLD_CAP)));
      if (!Array.isArray(w.mail)) w.mail = [];
      S.loot.wallets[k] = w;
    }
    return S;
  }

  // ---- 分队（团长分队 / 自动补齐）----
  // 多队版：m.team >= 0 的是团长手动分的；其余的按 m.party（同一个队伍的人尽量一队）、再按人数最少的队补齐。至少 minTeams 队，每队最多 teamSize 人。
  // 引导 / 两人版：不用分（引导 = 一队，两人版 = 每人一队）。返回 { ok, teams: [[uid…]…] } 或 { ok:false, code, text }
  function planTeams(S) {
    const D = def(S), A = act(S), uids = A.map(m => m.uid);
    if (S.tier === 'guide') return { ok: true, teams: [uids] };
    if (S.tier === 'duo') return { ok: true, teams: A.length >= 2 ? uids.map(u => [u]) : [uids] };
    const size = D.teamSize || 4, minP = D.minPlayers || 4, minT = D.minTeams || 2, maxT = D.maxTeams || 4;
    if (A.length < minP) return { ok: false, code: 'count', text: `多队版至少要 ${minP} 人（现在 ${A.length} 人）` };
    if (A.length > size * maxT) return { ok: false, code: 'count', text: `多队版最多 ${size * maxT} 人` };
    const bins = Array.from({ length: maxT }, () => []), free = [];
    let hi = 0, explicit = false;
    for (const m of A) { if (m.team >= 0 && m.team < maxT) { bins[m.team].push(m.uid); hi = Math.max(hi, m.team + 1); explicit = true; } else free.push(m); }
    if (bins.some(b => b.length > size)) return { ok: false, code: 'size', text: `每队最多 ${size} 人` };
    let limit = Math.max(hi, Math.min(maxT, Math.max(minT, Math.ceil(A.length / size))));
    const groups = new Map();
    for (const m of free) { const k = m.party != null ? 'p' + m.party : 'u' + m.uid; (groups.get(k) || groups.set(k, []).get(k)).push(m.uid); }
    const place = (g) => {
      for (;;) {
        let best = -1;
        for (let i = 0; i < limit; i++) if (size - bins[i].length >= g.length && (best < 0 || bins[i].length < bins[best].length)) best = i;
        if (best >= 0) { bins[best].push(...g); return; }
        if (g.length > 1) { g.splice(0).forEach(u => place([u])); return; }   // 放不下整组就拆开
        if (limit >= maxT) return;
        limit++;
      }
    };
    for (const g of [...groups.values()].sort((a, b) => b.length - a.length)) place(g);
    let teams = bins.filter(b => b.length);
    if (teams.length < minT) {
      if (explicit) return { ok: false, code: 'teams', text: `至少要分成 ${minT} 队` };
      const n = Math.min(minT, A.length), re = Array.from({ length: n }, () => []);
      uids.forEach((u, i) => re[i % n].push(u)); teams = re;
    }
    const order = new Map(uids.map((u, i) => [u, i]));
    return { ok: true, teams: teams.map(t => t.slice().sort((a, b) => order.get(a) - order.get(b))) };
  }
  // 给客户端看的分队：开始后 = 实际分队；大厅（多队版）= 团长已经手动分的队
  function teamsOf(S) {
    let list = S.teams;
    if (S.st === 'lobby') {
      if (S.tier !== 'team') return [];
      const by = {}; for (const m of act(S)) if (m.team >= 0) (by[m.team] = by[m.team] || []).push(m.uid);
      list = Object.keys(by).map(Number).sort((a, b) => a - b).map(i => ({ id: i, members: by[i] }));
    }
    return list.map(t => ({ id: t.id, name: `${t.id + 1} 队`, color: TEAM_COLORS[t.id % TEAM_COLORS.length], members: t.members.slice(),
      leader: (t.members.find(u => { const x = mem(S, u); return x && !x.left; }) ?? null) }));
  }
  const teamOf = (S, uid) => { const m = mem(S, uid); return m ? m.team : -1; };

  // ---- 阶段 ----
  function beginPhase(S, i, now, o) {
    const P = graph(S.raid, S.graph).phases[i], D = def(S);
    S.phase = i; S.st = 'routes'; S.phaseT0 = now; S.deadline = now + tlim(S, P.limit) * 1000; S.restUntil = 0; S.keys = {}; S.gbuffs = [];
    S.lives = byMode(D.lives, S); S.rev = {}; S.buffs = []; S.win = {}; S.cp = {}; S.marks = {}; S.aura = {}; S.glim = {};
    for (const R of Object.values(S.runs)) if (!R.end) { R.end = 'phase'; R.endAt = now; }
    S.nodes = {};
    for (const id of Object.keys(P.nodes)) S.nodes[id] = { st: 'locked', by: [], run: null, hp: 1, n: 0, order: 0, until: 0, timer: 0, hpStart: 0, seen: false, boss: false, openT: 0 };
    S.pools = {}; for (const k of Object.keys(P.pools)) S.pools[k] = { hp: 1, until: 0, by: {} };
    S.rot = P.rot ? Math.floor(rnd(S) * P.rot.forms.length) : 0;
    const groups = {};
    for (const nd of Object.values(P.nodes)) if (nd.type === 'order') (groups[nd.group] = groups[nd.group] || []).push(nd.id);
    for (const ids of Object.values(groups)) rollOrder(S, ids);
    for (const m of S.members) m.at = 'camp';
    push(o, 'all', 'phase', null, { phase: P.id, start: true, deadline: S.deadline, lives: S.lives });
    note(o, 'all', `${P.name}开始：限时 ${Math.round(tlim(S, P.limit) / 60)} 分钟`);
  }
  function rollOrder(S, ids) {
    const pool = []; for (let k = 1; k <= Math.max(def(S).orderMax || 4, ids.length); k++) pool.push(k);
    for (const id of ids) S.nodes[id].order = pool.splice(Math.floor(rnd(S) * pool.length), 1)[0];
  }
  function phaseDone(S, now, o) {
    const G = graph(S.raid, S.graph), P = G.phases[S.phase];
    if (S.res.phases.includes(P.id)) return;
    S.res.phases.push(P.id); S.res.used[P.id] = now - S.phaseT0;
    ensureMeta(S);
    // 休整 / 结算先锁住翻牌，再由客户端明确打开结算窗口。翻牌完成前不会进入下一阶段。
    S.flip = { state: 'ready', phase: P.id, openedAt: 0, closedAt: 0, cards: {} };
    push(o, 'all', 'phase', null, { phase: P.id, ok: true, used: now - S.phaseT0 });
    if (S.phase >= G.phases.length - 1) return end(S, now, o, true, 'clear');
    S.st = 'rest'; S.restUntil = now + def(S).rest * 1000;
    note(o, 'all', `${P.name}完成！先完成全员翻牌，休整 ${Math.round(def(S).rest / 60)} 分钟后进入下一阶段（团长可在倒计时后开始）`);
  }
  function flipComplete(S) {
    ensureMeta(S);
    if (S.flip.state === 'closed') return true;
    const eligible = act(S).filter(m => m.rw !== false);
    return eligible.length === 0 || eligible.every(m => {
      const c = S.flip.cards[String(m.uid)]; return c && c.closedAt;
    });
  }
  function end(S, now, o, ok, why) {
    if (!LIVE[S.st]) return;
    S.st = ok ? 'cleared' : 'failed'; S.why = why; S.ended = now;
    for (const R of Object.values(S.runs)) if (!R.end) { R.end = why; R.endAt = now; }
    for (const m of S.members) m.at = 'camp';
    ensureMeta(S);
    // 成功通关进入最终翻牌；失败也要保留最后一个已完成阶段的翻牌状态，
    // 这样超时 / 中途放弃不会吞掉已经打完但尚未领取的阶段奖励。
    if (ok) S.flip = { state: 'ready', phase: S.res.phases[S.res.phases.length - 1] || 0, openedAt: 0, closedAt: 0, cards: {} };
    else {
      const p = S.res.phases[S.res.phases.length - 1] || 0;
      if (!p) S.flip = { state: 'none', phase: 0, openedAt: 0, closedAt: 0, cards: {} };
      else if (!S.flip || S.flip.phase !== p || S.flip.state === 'none') S.flip = { state: 'ready', phase: p, openedAt: 0, closedAt: 0, cards: {} };
    }
    push(o, 'all', 'end', null, { ok, why, phases: S.res.phases.slice(), flip: S.flip.state === 'ready' });
  }

  // ---- 节点 ----
  function myTurn(S, nd) {
    const P = phaseOf(S);
    const left = Object.values(P.nodes).filter(x => x.type === 'order' && x.group === nd.group && S.nodes[x.id].st !== 'cleared');
    return !left.some(x => S.nodes[x.id].order < S.nodes[nd.id].order);
  }
  function twin(S, nd) { return Object.values(phaseOf(S).nodes).find(x => x.type === 'sync' && x.group === nd.group && x.id !== nd.id) || null; }
  function activeBuffs(S, id, now) { return S.buffs.filter(b => b.node === id && (!b.until || b.until > now)).map(b => ({ id: b.id, kind: b.kind, p: b.p, until: b.until })); }
  // 理智值（def.sanity = { max, restore }）：归零第一次 = 进小游戏恢复到 restore，第二次 = 倒下（客户端按 sanity fx 的 dead 处理）
  function sanityAdd(S, m, d, o) {
    const D = def(S).sanity; if (!D || !m || m.left || m.san == null) return;
    // 全团增益里的 sanMax（赛赫之类的功能图）= 理智上限加成
    const max = (D.max || 100) + (S.gbuffs || []).reduce((a, b) => a + ((b.p && b.p.sanMax) || 0), 0); m.san = Math.max(0, Math.min(max, m.san + d));
    if (m.san > 0) { push(o, [m.uid], 'sanity', null, { v: m.san, max }); return; }
    m.sanZ = (m.sanZ || 0) + 1;
    if (m.sanZ === 1) { m.san = D.restore ?? 50; push(o, [m.uid], 'sanity', null, { v: m.san, mini: true }); note(o, [m.uid], '理智值归零：进入小游戏恢复理智（再次归零会倒下）'); }
    else { push(o, [m.uid], 'sanity', null, { v: 0, dead: true }); note(o, 'all', `${m.name} 理智归零倒下了`); }
  }
  function applyFx(S, nd, list, now, o) {
    for (const f of list || []) {
      const to = f.to || nd.id, T = S.nodes[to];
      if (f.kind === 'buff' || f.kind === 'groggy') {
        if (f.ifBoss && !(T && T.st === 'busy' && T.boss)) { note(o, 'all', `「${(nodeOf(S, to) || {}).name || to}」那边还没到领主房：没有效果`, to); continue; }
        const id = f.id || f.kind, until = f.dur ? now + f.dur * 1000 : 0;
        S.buffs = S.buffs.filter(b => !(b.node === to && b.id === id));
        S.buffs.push({ id, node: to, kind: f.kind, p: f.p || {}, until, from: nd.id });
        push(o, runners(S, to), f.kind, to, { id, p: f.p || {}, dur: f.dur || 0, until });
      } else if (f.kind === 'stack') {
        const id = f.id || 'stack', old = S.buffs.find(b => b.node === to && b.id === id), n = Math.min(f.steps.length, (old ? old.n || 1 : 0) + 1), until = now + (f.dur || 60) * 1000;
        S.buffs = S.buffs.filter(b => b !== old);
        const p = { dmgTaken: f.steps[n - 1] };
        S.buffs.push({ id, node: to, kind: 'buff', p, until, from: nd.id, n });
        push(o, runners(S, to), 'buff', to, { id, p, dur: f.dur || 60, until, n });
        if (f.text) { note(o, 'all', `${f.text}（${n} 层：伤害 ×${f.steps[n - 1]}）`, to); continue; }
      } else if (f.kind === 'gbuff') {
        // 全团增益（功能图）：不属于某个节点，所有队的所有挑战都吃；dur 秒（0 = 直到这个阶段结束）。同 id 刷新
        const id = f.id || 'gbuff', until = f.dur ? now + f.dur * 1000 : 0;
        S.gbuffs = S.gbuffs.filter(b => b.id !== id);
        S.gbuffs.push({ id, p: f.p || {}, until, from: nd.id });
        push(o, 'all', 'gbuff', nd.id, { id, p: f.p || {}, dur: f.dur || 0, until });
      } else if (f.kind === 'key') {
        S.keys[f.id] = true; push(o, 'all', 'key', nd.id, { id: f.id });
      } else if (f.kind === 'unlock') {   // 强制打开一个节点（开关节点；精英 / 机关击杀用）
        if (T && T.st === 'locked') { openNode(S, nodeOf(S, to), now); push(o, 'all', 'unlock', to, {}); }
      } else if (f.kind === 'lock') {
        if (T && T.st === 'open' && !T.run) { T.st = 'locked'; T.until = 0; push(o, 'all', 'lock', to, {}); }
      } else if (f.kind === 'countdown') {   // 给倒计时节点开始 / 重置倒计时（精英击杀触发倒计时；节点没开放时不动）
        const tnd = nodeOf(S, to);
        if (T && tnd && (T.st === 'open' || T.st === 'busy')) { T.timer = now + (f.sec || tnd.timer || 60) * 1000; push(o, 'all', 'countdown', to, { until: T.timer }); }
      } else if (f.kind === 'sanity') {   // 理智值：to = 'all'（默认，在线全员）| 'run'（这个节点里的人）
        const ids = f.who === 'run' ? runners(S, to) : act(S).map(m => m.uid);
        for (const u of ids) sanityAdd(S, mem(S, u), f.v || 0, o);
      } else if (f.kind === 'chaos') {   // 混沌等级：+ / − 级，夹在 1~max
        if (S.chaos) { S.chaos.lv = Math.max(1, Math.min(S.chaos.max, S.chaos.lv + (f.v || 1))); push(o, 'all', 'chaos', nd.id, { lv: S.chaos.lv }); }
      } else if (f.kind === 'heal') {
        if (!T || T.st === 'cleared') continue;
        T.hp = 1; push(o, runners(S, to), 'heal', to, { hp: 1 });
      } else if (f.kind === 'time') {
        S.deadline += f.v * 1000; push(o, 'all', 'time', null, { v: f.v, deadline: S.deadline });
      } else if (f.kind === 'reset') resetArea(S, f.areas, now, o);
      else if (f.kind === 'rotate') rotate(S, now, o);
      else if (f.kind === 'merge') {
        const P = phaseOf(S), R0 = P.rot;
        if (R0 && S.rot !== R0.resonance) { applyFx(S, nd, f.miss, now, o); continue; }
        merge(S, f, now, o);
      }
      if (f.text) note(o, 'all', f.text, f.to || null);
    }
  }
  // 重置一层（痛苦之镜 / 否定到点）：取 areas 里最靠后、已经开放的一层；倒计时节点自己不动。里面的人踢回营地（不算侵蚀），进度 / 效果 / 共享血量清零
  function resetArea(S, areas, now, o) {
    const P = phaseOf(S), list = Object.values(P.nodes);
    const live = areas.filter(a => list.some(nd => nd.area === a && nd.type !== 'timer' && S.nodes[nd.id].st !== 'locked'));
    if (!live.length) return;
    const area = Math.max(...live), ids = list.filter(nd => nd.area === area && nd.type !== 'timer').map(nd => nd.id);
    S.stats.penalties++;
    for (const id of ids) {
      const N = S.nodes[id], R = N.run ? S.runs[N.run] : null;
      if (R && !R.end) { push(o, R.by.slice(), 'closed', id, { why: 'reset' }); endRun(S, R, 'reset', now, o); }
      Object.assign(N, { st: 'locked', hp: 1, hpStart: 0, until: 0, timer: 0, boss: false, seen: false });
      delete S.cp[id];
      if (canOpen(S, nodeOf(S, id))) openNode(S, nodeOf(S, id), now);   // 前置还满足的立刻重新开放（同一刻两面镜子都到点也只重置这一层）
      S.buffs = S.buffs.filter(b => b.node !== id && b.from !== id);
    }
    for (const k of Object.keys(S.aura)) if (ids.includes(S.aura[k].src) || ids.includes(S.aura[k].to)) delete S.aura[k];
    const pools = new Set(ids.map(id => nodeOf(S, id).pool).filter(Boolean));
    for (const k of pools) { S.pools[k] = { hp: 1, until: 0, by: {} }; }
    if (P.rot && pools.has(P.rot.pool)) S.rot = Math.floor(rnd(S) * P.rot.forms.length);
    push(o, 'all', 'reset', null, { area, nodes: ids });
  }
  // 旋转（压抑）：所有带 slot 的节点换形态；转到 resonance 那一格 = 共鸣
  function rotate(S, now, o) {
    const R0 = phaseOf(S).rot; if (!R0) return;
    S.rot = (S.rot + 1) % R0.forms.length;
    push(o, 'all', 'rotate', null, { rot: S.rot, res: S.rot === R0.resonance });
    note(o, 'all', S.rot === R0.resonance ? '真理的意识之棺和忘却共鸣了！现在通关忘却 = 合并成阴影之棺' : `真理的意识之棺转到了：${formsNow(S).join(' / ')}（还没共鸣）`);
  }
  function formsNow(S) {
    const P = phaseOf(S), R0 = P.rot; if (!R0) return [];
    return Object.values(P.nodes).filter(nd => nd.pool === R0.pool && nd.slot != null).sort((a, b) => a.slot - b.slot).map(nd => R0.forms[(nd.slot + S.rot) % R0.forms.length]);
  }
  // 合并（忘却 + 共鸣）：同一个血量池里正在打的挑战都结束（伤害保留、不算侵蚀），打开阴影之棺 window 秒
  function merge(S, f, now, o) {
    const P = phaseOf(S), tnd = nodeOf(S, f.to), T = S.nodes[f.to]; if (!tnd || !T) return;
    for (const nd of Object.values(P.nodes)) {
      if (nd.pool !== tnd.pool || nd.id === tnd.id) continue;
      const N = S.nodes[nd.id], R = N.run ? S.runs[N.run] : null;
      if (R && !R.end) { push(o, R.by.slice(), 'closed', nd.id, { why: 'merge' }); endRun(S, R, 'merge', now, o); }
    }
    if (T.st === 'locked') { T.st = 'open'; T.until = now + (f.window || 60) * 1000; T.openT = now; }
    push(o, 'all', 'merge', f.to, { until: T.until });
  }
  function clearNode(S, id, now, o) {
    const nd = nodeOf(S, id), N = S.nodes[id], who = runners(S, id);
    N.n++; N.hp = 0; N.hpStart = 0; delete S.cp[id];
    if (nd.type === 'buff' || nd.type === 'func') { N.st = 'cool'; N.until = nd.respawn === 0 ? 0 : now + (nd.respawn || 120) * 1000; }   // respawn 0 = 不重生（直到 failReset）；func = 功能图（通关给全团加增益，见 fx gbuff）
    else if (nd.type === 'timer') { N.st = 'cool'; N.until = now + (nd.repair || 90) * 1000; N.timer = 0; }
    else N.st = 'cleared';
    if (nd.group && S.glim && S.glim[nd.group] && Object.values(phaseOf(S).nodes).every(x => x.group !== nd.group || S.nodes[x.id].st === 'cleared')) delete S.glim[nd.group];
    push(o, who, 'done', id, { ok: true });
    note(o, 'all', `${who.length ? names(S, who) : '队友'} 通关了「${nd.name}」`, id);
    applyFx(S, nd, nd.fx && nd.fx.clear, now, o);   // 增益 / 功能 / 钥匙图通关的跨节点效果（别的类型没写 fx.clear 就没有）
  }
  function openNode(S, nd, now) {
    const N = S.nodes[nd.id];
    N.st = 'open'; N.until = 0; N.openT = now;
    if (nd.type === 'timer') N.timer = S.sub ? 0 : now + nd.timer * 1000;
  }
  const QUIET = { clear: 1, phase: 1, merge: 1, kick: 1, reset: 1 };   // 这些结束方式不算“没打完”（不触发 failKick / 共享血量退回）
  function endRun(S, R, why, now, o) {
    if (R.end) return;
    R.end = why; R.endAt = now;
    for (const u of R.by) { const x = mem(S, u); if (x && x.at === R.node) x.at = 'camp'; }
    const N = S.nodes[R.node], nd = nodeOf(S, R.node);
    if (N && N.run === R.id) {
      N.run = null; N.by = [];
      if (N.st === 'busy') { N.st = 'open'; N.hp = S.cp[R.node] ? S.cp[R.node].hp : 1; }
      if (why !== 'clear') N.boss = false;
      if (nd && nd.pool && S.pools[nd.pool]) N.hp = S.pools[nd.pool].hp;
    }
    if (!nd || !o) return;
    const P = nd.pool && S.pools[nd.pool];
    if (P && (why === 'retreat' || why === 'dead' || why === 'lost') && R.dealt > 0 && P.hp > 0) { P.hp = Math.min(1, P.hp + R.dealt); poolBy(P, R, -R.dealt); R.dealt = 0; poolSync(S, nd.pool, o); note(o, 'all', `「${nd.name}」的队伍撤出：这次造成的伤害退回了（共享血量 ${Math.round(P.hp * 100)}%）`, nd.id); }
    if (nd.manual && N && N.st !== 'cleared') { N.st = 'locked'; N.until = 0; reopenAfterMerge(S, now); }
    if (QUIET[why]) return;
    for (const id of nd.failKick || []) {
      const K = S.nodes[id], KR = K && K.run ? S.runs[K.run] : null;
      if (KR && !KR.end) { push(o, KR.by.slice(), 'closed', id, { why: 'kick', from: nd.id }); endRun(S, KR, 'kick', now, o); }
    }
    for (const id of nd.failReset || []) {
      const K = S.nodes[id], knd = nodeOf(S, id); if (!K || K.st === 'cleared' || K.st === 'off') continue;
      K.st = knd.needBoss && knd.needBoss.length ? 'locked' : 'open'; K.until = 0; K.hp = 1;
      const gone = S.buffs.filter(b => b.from === id); S.buffs = S.buffs.filter(b => b.from !== id);
      for (const b of gone) push(o, runners(S, b.node), 'unbuff', b.node, { id: b.id });
    }
    if ((nd.failKick || []).length) note(o, 'all', `「${nd.name}」没打完：关联的地下城也结束了`, nd.id);
  }
  // 阴影之棺结束（时间到 / 没人进）：形态之棺重新出现，第 1 界的无欲之棺立刻开放（不管重生时间）[QQ]
  function reopenAfterMerge(S, now) {
    const P = phaseOf(S);
    for (const nd of Object.values(P.nodes)) { const N = S.nodes[nd.id]; if (nd.area === (Object.values(P.nodes).find(x => x.manual) || {}).area && N.st === 'cool' && nd.type !== 'timer') openNode(S, nd, now); }
  }
  // 共享血量：服务端记着每次挑战“客户端现在的血量”（R.ph），池子变了就把差值发给每个正在打的挑战（客户端按差值加减，没上报的伤害不会丢）
  // 共享血量按队伍（= 挑战的主机）记各打掉了多少：领主血条按队伍颜色显示 [QQ]；撤退退回时也从那一队扣掉
  function poolBy(P, R, d) { if (!d) return; const by = P.by || (P.by = {}), k = R.host; by[k] = Math.max(0, (by[k] || 0) + d); if (by[k] < 1e-6) delete by[k]; }
  function poolSync(S, k, o) {
    const P = S.pools[k]; if (!P) return;
    for (const R of Object.values(S.runs)) {
      if (R.end || R.ph == null) continue;
      const nd = nodeOf(S, R.node); if (!nd || nd.pool !== k) continue;
      const d = P.hp - R.ph; if (Math.abs(d) < 1e-6) continue;
      R.ph = P.hp; push(o, R.by.slice(), 'pool', R.node, { hp: P.hp, d, by: Object.assign({}, P.by) });
    }
  }
  function poolClear(S, k, now, o) {
    const P = S.pools[k]; P.hp = 0;
    for (const nd of Object.values(phaseOf(S).nodes)) {
      if (nd.pool !== k) continue;
      const N = S.nodes[nd.id];
      if (N.st === 'cleared') continue;
      if (N.run && S.runs[N.run] && !S.runs[N.run].end) { const R = S.runs[N.run]; R.down = R.down || now; push(o, R.by.slice(), 'pool', nd.id, { hp: 0, d: -(R.ph || 0) }); R.ph = 0; }
      N.until = 0; clearNode(S, nd.id, now, o);
    }
  }
  // 离开这次挑战：主机走了（或者没人在线了）整场结束、节点重置（存档点保留，下一个进来的人接着打）；队员走了队伍继续
  function leaveRun(S, R, m, why, now, o) {
    const D = def(S);
    if (why !== 'lost') { m.ero = now + byMode(D.erosion, S) * 1000; push(o, [m.uid], 'erosion', R.node, { until: m.ero }); }
    const rest = R.by.filter(u => u !== m.uid), alive = rest.filter(u => { const x = mem(S, u); return x && x.online && !x.left; });
    if (m.uid === R.host || !alive.length) {
      if (rest.length) push(o, rest, 'closed', R.node, { why: m.uid === R.host ? 'host' : 'empty' });
      endRun(S, R, why, now, o);
    } else {
      R.by = rest; (R.gone = R.gone || []).push(m.uid);
      if (m.at === R.node) m.at = 'camp';
      const N = S.nodes[R.node]; if (N && N.run === R.id) N.by = rest.slice();
    }
  }
  function twinGuard(S, nd, now, o) {
    const o2 = twin(S, nd); if (!o2) return;
    const a = S.nodes[nd.id], b = S.nodes[o2.id];
    let hi = null;
    if (a.st === 'busy' && b.st === 'busy' && Math.abs(a.hp - b.hp) > (nd.diff || 0.25)) hi = a.hp > b.hp ? nd.id : o2.id;
    for (const x of [nd, o2]) {
      const has = S.buffs.some(b2 => b2.node === x.id && b2.id === 'twin_guard');
      if (x.id === hi && !has) {
        S.buffs.push({ id: 'twin_guard', node: x.id, kind: 'buff', p: { dmgTaken: x.guard || 0.5 }, until: 0, from: x.id });
        push(o, runners(S, x.id), 'buff', x.id, { id: 'twin_guard', p: { dmgTaken: x.guard || 0.5 }, dur: 0, until: 0 });
      } else if (x.id !== hi && has) {
        S.buffs = S.buffs.filter(b2 => !(b2.node === x.id && b2.id === 'twin_guard'));
        push(o, runners(S, x.id), 'unbuff', x.id, { id: 'twin_guard' });
      }
    }
  }
  // 领主倒下（顺序 / 同步 / 其他）：决定性事件，每次挑战只认一次
  function downRun(S, R, now, o) {
    const nd = nodeOf(S, R.node), N = S.nodes[R.node];
    if (R.down) return fail(o, 'dup', '这次挑战已经上报过了');
    const rawMin = nd.minClear != null ? nd.minClear : (S.guard && S.guard.minClear);
    const minSec = (S.mode === 'guide' || S.tier === 'guide' || S.graph === 'guide')
      ? (typeof rawMin === 'object' && rawMin ? (byMode(rawMin, S) || 0) : 0)
      : (typeof rawMin === 'object' && rawMin ? (byMode(rawMin, S) || 5) : (rawMin != null ? Number(rawMin) : 5));
    const min = Math.max(0, minSec) * 1000 * (R.hp0 ?? 1);
    if (min > 0 && now - R.t0 < min) return fail(o, 'fast', '通关时间不合理（太快了）');
    if (nd.type === 'order' && !S.sub && !myTurn(S, nd)) {
      for (const x of Object.values(phaseOf(S).nodes)) {
        if (x.type !== 'order' || x.group !== nd.group || S.nodes[x.id].st !== 'busy') continue;
        S.nodes[x.id].hp = 1; push(o, runners(S, x.id), 'heal', x.id, { hp: 1, why: 'order' });
      }
      S.stats.penalties++;
      note(o, 'all', '顺序错了：两边的守门人都回满了血（数字小的先打倒）', nd.id);
      o.ack = { res: 'heal' };
      return o;
    }
    R.down = now;
    if (nd.pool && S.pools[nd.pool]) {   // 共享血量：哪一边把自己那份打空都算池子空了（客户端的领主血量一直跟着池子走）
      const P = S.pools[nd.pool]; poolBy(P, R, Math.min(P.hp, R.ph || 0)); P.hp = Math.max(0, P.hp - (R.ph || 0)); R.dealt = (R.dealt || 0) + (R.ph || 0); R.ph = 0;
      poolClear(S, nd.pool, now, o);
      note(o, 'all', `${def(S).phases.find(x => x.id === phaseOf(S).id).pools[nd.pool].name || '共享领主'}的血量打空了！`);
      o.ack = { res: 'clear' };
      return o;
    }
    if (nd.type === 'sync') {
      const ot = twin(S, nd), W = S.win[nd.group];
      if (ot && W && W.node === ot.id && W.until > now && S.nodes[ot.id].st === 'down') {
        delete S.win[nd.group];
        S.buffs = S.buffs.filter(b => b.id !== 'twin_guard');
        clearNode(S, ot.id, now, o); clearNode(S, nd.id, now, o);
        note(o, 'all', `双生同时倒下！（相差 ${Math.round((now - W.t0) / 100) / 10} 秒）`);
        o.ack = { res: 'clear' };
        return o;
      }
      const w = (S.sub ? def(S).subWindow : nd.window || 30) * 1000;
      N.st = 'down'; S.win[nd.group] = { node: nd.id, t0: now, until: now + w };
      if (ot) push(o, runners(S, ot.id), 'window', ot.id, { from: nd.id, until: now + w, left: w });
      note(o, 'all', `「${nd.name}」的领主倒下了：${w / 1000} 秒内打倒另一边，不然它会复活`, nd.id);
      o.ack = { res: 'down' };
      return o;
    }
    clearNode(S, nd.id, now, o);
    o.ack = { res: 'clear' };
    return o;
  }
  // 同一次挑战的上报：先对上挑战编号，再按 q（每人每次挑战递增）去重（重连补发的旧事件直接回 dup）
  function runOf(S, ev, o, m, hostOnly) {
    const R = typeof ev.run === 'string' && Object.prototype.hasOwnProperty.call(S.runs, ev.run) ? S.runs[ev.run] : null;
    if (!R || (ev.node != null && ev.node !== R.node)) { fail(o, 'run', '没有这次挑战'); return null; }
    const q = Number.isInteger(ev.q) ? ev.q : null, last = (R.q && R.q[m.uid]) || 0;
    if (q !== null && q <= last) { o.ack = { dup: true }; return null; }
    if (R.end || (R.gone && R.gone.includes(m.uid))) { fail(o, 'ended', '这次挑战已经结束了'); return null; }
    if (!R.by.includes(m.uid)) { fail(o, 'notyours', '这不是你的挑战'); return null; }
    if (hostOnly && R.host !== m.uid) { fail(o, 'host', '只有这次挑战的主机能上报'); return null; }
    if (q !== null) (R.q = R.q || {})[m.uid] = q;
    return R;
  }

  // ---- 补位：普通模式里队友离线超过 subAfter 秒（或者离开了团本），必须分头的规则放宽，保证一个人能打完 ----
  function subNow(S, now) {
    if (S.graph !== 'normal') return false;
    const A = act(S);
    if (A.length < 2) return true;
    // 有一整队都走了 / 离线超过 subAfter 秒 = 队数不够并行了（两人版：队友离线 = 少一队）
    const live = new Set(A.filter(m => m.online || now - m.offAt < def(S).subAfter * 1000).map(m => m.team));
    return live.size < (S.nTeams || 2);
  }
  function setSub(S, on, now, o) {
    const D = def(S), P = phaseOf(S);
    S.sub = on;
    for (const nd of Object.values(P.nodes)) {
      const N = S.nodes[nd.id];
      if (nd.type === 'timer' && (N.st === 'open' || N.st === 'busy')) N.timer = on ? 0 : now + nd.timer * 1000;
    }
    if (on) for (const W of Object.values(S.win)) W.until = Math.max(W.until, W.t0 + D.subWindow * 1000);
    push(o, 'all', 'sub', null, { on });
    note(o, 'all', on ? `队友离线超过 ${Math.round(D.subAfter / 60)} 分钟：切换到补位规则（顺序不限、镜子暂停、双生窗口 ${D.subWindow} 秒）` : '队友回来了：恢复正常规则');
  }

  // ---- 按时间推进（每条事件之前、每次 tick 都先跑：结果只取决于事件和它们的时间，和 tick 的频率无关）----
  function advance(S, now, o) {
    if (!LIVE[S.st]) return;
    const D = def(S);
    for (const m of S.members) if (m.ero && m.ero <= now) m.ero = 0;
    if (S.st === 'lobby') return;
    if (S.st === 'rest') { if (now >= S.restUntil && flipComplete(S)) beginPhase(S, S.phase + 1, now, o); return; }
    if (now >= S.deadline) return end(S, now, o, false, 'timeout');
    const sub = subNow(S, now);
    if (sub !== S.sub) setSub(S, sub, now, o);
    // 挑战里的人全都离线超过 subAfter 秒、而别的队员在线：放出这个节点（离线的人回来补发的旧事件会被拒绝）；只有自己一个人时不放，回来接着打
    for (const R of Object.values(S.runs)) {
      const gone = u => { const x = mem(S, u); return !x || x.left || (!x.online && now - x.offAt >= D.subAfter * 1000); };
      if (!R.end && R.by.every(gone) && act(S).some(x => x.online && !R.by.includes(x.uid))) {
        push(o, 'all', 'closed', R.node, { why: 'offline' });
        endRun(S, R, 'lost', now, o);
      }
      if (R.end && now - R.endAt > 600000) delete S.runs[R.id];
    }
    const P = phaseOf(S);
    for (const nd of Object.values(P.nodes)) {
      const N = S.nodes[nd.id];
      if (N.st === 'cool' && N.until && N.until <= now) openNode(S, nd, now);
      if (nd.manual && N.st === 'open' && !N.run && N.until && N.until <= now) { N.st = 'locked'; N.until = 0; reopenAfterMerge(S, now); note(o, 'all', `「${nd.name}」没人进：关闭了`, nd.id); }
      if (nd.type === 'timer' && N.timer && N.timer <= now && (N.st === 'open' || N.st === 'busy')) {
        N.timer = now + nd.timer * 1000; S.stats.penalties++;
        note(o, 'all', `「${nd.name}」的倒计时到了！`, nd.id);
        applyFx(S, nd, nd.fx && nd.fx.expire, now, o);
      }
    }
    groupLimits(S, now, o);
    runLimits(S, now, o);
    if (!S.sub) auras(S, now, o);
    for (const k of Object.keys(S.pools || {})) {
      const PL = S.pools[k]; if (!PL.until || PL.until > now || PL.hp <= 0) continue;
      note(o, 'all', `${(def(S).phases.find(x => x.id === P.id).pools[k] || {}).name || '共享领主'}没能在时限内打倒：攻坚失败`);
      return end(S, now, o, false, 'pool');
    }
    for (const g of Object.keys(S.win)) {
      const W = S.win[g]; if (W.until > now) continue;
      delete S.win[g];
      const N = S.nodes[W.node], nd = nodeOf(S, W.node); if (!N || N.st !== 'down') continue;
      const R = N.run ? S.runs[N.run] : null, hp = nd.revive || 0.5;
      if (R && !R.end) { N.st = 'busy'; N.hp = hp; R.down = 0; push(o, R.by, 'revive', W.node, { hp }); }
      else { N.st = 'open'; N.hp = hp; N.hpStart = hp; }
      note(o, 'all', `没能同时打倒：「${nd.name}」的领主以 ${Math.round(hp * 100)}% 血复活了`, W.node);
    }
    if (now >= S.deadline) end(S, now, o, false, 'timeout');
  }
  // 顺序组共享时限（破坏之门）：到点没全部通关 → 整组进度清零、里面的人踢回营地、重新分配顺序 [QQ]
  function groupLimits(S, now, o) {
    const P = phaseOf(S);
    for (const g of Object.keys(S.glim || {})) {
      const L = S.glim[g], ids = Object.values(P.nodes).filter(nd => nd.group === g).map(nd => nd.id);
      if (ids.every(id => S.nodes[id].st === 'cleared')) { delete S.glim[g]; continue; }
      if (S.sub) { L.until = Math.max(L.until, now + 1000); continue; }   // 补位（只剩一个人）时不计时
      if (L.until > now) continue;
      delete S.glim[g]; S.stats.penalties++;
      for (const id of ids) {
        const N = S.nodes[id], R = N.run ? S.runs[N.run] : null;
        if (R && !R.end) { push(o, R.by.slice(), 'closed', id, { why: 'reset' }); endRun(S, R, 'reset', now, o); }
        Object.assign(N, { st: 'open', hp: 1, hpStart: 0, boss: false });
      }
      rollOrder(S, ids);
      push(o, 'all', 'reset', null, { group: g, nodes: ids });
      note(o, 'all', '共享时限到了：破坏之门的进度全部重置，顺序重新分配');
    }
  }
  // 单次挑战时限（梦幻之黎明 7 分钟、忘却 5 分钟、阴影之棺 30 秒）：到点踢回营地（kickEro = 侵蚀秒数）
  function runLimits(S, now, o) {
    for (const R of Object.values(S.runs)) {
      if (R.end || !R.limit || R.limit > now) continue;
      const nd = nodeOf(S, R.node); if (!nd) continue;
      const ero = byMode(nd.kickEro, S);
      push(o, R.by.slice(), 'closed', R.node, { why: 'limit' });
      if (ero) for (const u of R.by) { const m = mem(S, u); if (m) { m.ero = now + ero * 1000; push(o, [u], 'erosion', R.node, { until: m.ero }); } }
      note(o, 'all', `「${nd.name}」时间到了：${names(S, R.by)} 被送回营地`, nd.id);
      endRun(S, R, 'limit', now, o);
    }
  }
  // 跨图持续惩罚（aura）：源节点没通关期间，每 every 秒给目标节点“正在进行的那次挑战”叠一层；目标换了一次挑战就从 0 开始
  function auras(S, now, o) {
    const P = phaseOf(S), pen = scaleOf(S).pen ?? 1;
    if (!scale(S, null, 1).penalty) return;
    for (const nd of Object.values(P.nodes)) {
      if (!nd.aura) continue;
      const N = S.nodes[nd.id]; if (N.st !== 'open' && N.st !== 'busy') continue;
      for (const A of nd.aura) {
        const T = S.nodes[A.to], R = T && T.run ? S.runs[T.run] : null, k = nd.id + '>' + A.to + ':' + A.id;
        let st = S.aura[k];
        if (!R || R.end) { if (st) delete S.aura[k]; continue; }
        if (!st || st.run !== R.id) st = S.aura[k] = { src: nd.id, to: A.to, run: R.id, n: 0, next: Math.max(R.t0, N.openT || 0) + A.every * 1000 };
        let grew = false;
        while (st.next <= now) { st.next += A.every * 1000; st.n = Math.min(A.max || 99, st.n + 1); grew = true; }
        if (!grew) continue;
        const p = {}; for (const [kk, v] of Object.entries(A.p || {})) p[kk] = typeof v === 'number' && kk !== 'n' && kk !== 'blind' ? +(v * st.n * pen).toFixed(4) : v;
        S.buffs = S.buffs.filter(b => !(b.node === A.to && b.id === A.id));
        S.buffs.push({ id: A.id, node: A.to, kind: 'aura', p, until: 0, from: nd.id, n: st.n });
        push(o, R.by.slice(), 'buff', A.to, { id: A.id, p, dur: 0, until: 0, n: st.n, aura: nd.id, tick: true });
        if (A.text) note(o, R.by.slice(), `${A.text}（${st.n} 层）`, A.to);
      }
    }
  }
  const canOpen = (S, nd) => !nd.manual && nd.need.every(x => S.nodes[x].st === 'cleared') && (nd.needKey || []).every(k => S.keys[k]) && nd.needEnter.every(x => S.nodes[x].seen) && (!nd.needBoss.length || nd.needBoss.some(x => S.nodes[x].boss));
  function sweep(S, now, o) {
    if (S.st !== 'routes' && S.st !== 'final') return;
    const P = phaseOf(S);
    for (let again = true; again;) {
      again = false;
      for (const nd of Object.values(P.nodes)) {
        const N = S.nodes[nd.id];
        if (N.st === 'locked' && canOpen(S, nd)) { openNode(S, nd, now); again = true; }
        const stop = nd.stopWhen && S.nodes[nd.stopWhen];
        if (stop && stop.st === 'cleared' && N.st !== 'off' && !N.run) { N.st = 'off'; N.until = 0; N.timer = 0; }
      }
    }
    S.gbuffs = S.gbuffs.filter(b => { const gone = b.until && b.until <= now; if (gone) push(o, 'all', 'ungbuff', b.from, { id: b.id }); return !gone; });
    for (const k of Object.keys(S.aura || {})) { const A = S.aura[k], N = S.nodes[A.src]; if (!N || (N.st !== 'open' && N.st !== 'busy')) delete S.aura[k]; }
    S.buffs = S.buffs.filter(b => {
      const src = b.kind === 'aura' && S.nodes[b.from];
      const gone = (b.until && b.until <= now) || (S.nodes[b.node] && S.nodes[b.node].st === 'cleared') || (src && src.st !== 'open' && src.st !== 'busy')
        || (b.kind === 'aura' && !S.aura[b.from + '>' + b.node + ':' + b.id]);
      if (gone) push(o, runners(S, b.node), 'unbuff', b.node, { id: b.id });
      return !gone;
    });
    if (P.goal.every(x => S.nodes[x].st === 'cleared')) return phaseDone(S, now, o);
    const fin = Object.values(P.nodes).some(nd => nd.type === 'final' && (S.nodes[nd.id].st === 'open' || S.nodes[nd.id].st === 'busy'));
    if (S.st === 'routes' && fin) { S.st = 'final'; note(o, 'all', '最终领主的门开了：集合一起进！'); }
    else if (S.st === 'final' && !fin) S.st = 'routes';
  }

  function canStart(S, uid) {
    if (S.leader !== uid) return { code: 'leader', text: '只有团长能开始' };
    if (S.st === 'rest') return flipComplete(S) ? null : { code: 'flip', text: '请全员完成翻牌后再开始下一阶段' };
    if (S.st !== 'lobby') return { code: 'state', text: '团本已经开始了' };
    const A = act(S);
    if (A.some(m => !m.online)) return { code: 'offline', text: '还有人不在线' };
    if (A.some(m => !m.ready && m.uid !== S.leader)) return { code: 'ready', text: '还有人没准备好' };
    if (S.tier === 'team') { const p = planTeams(S); if (!p.ok) return { code: p.code, text: p.text }; }
    return null;
  }

  // ---- 事件 ----
  const EV = {
    join(S, ev, now, o, m) {
      if (S.st !== 'lobby') return fail(o, 'state', '团本已经开始了');
      const D = def(S);
      if (m) { m.cid = String(ev.cid || m.cid); m.name = String(ev.name || m.name); m.cls = ev.cls || m.cls; m.job = ev.job || m.job; if (ev.party != null) m.party = String(ev.party); return; }
      if (S.mode === 'guide') return fail(o, 'guide', '引导模式只能一个人打');
      if (act(S).length >= capacity(S)) return fail(o, 'full', `这个团本最多 ${capacity(S)} 人`);
      addMember(S, ev);
      if (D.sanity) S.members[S.members.length - 1].san = D.sanity.max || 100;
      note(o, 'all', `${ev.name || '队友'} 加入了团本`);
    },
    ready(S, ev, now, o, m) {
      if (S.st !== 'lobby') return fail(o, 'state', '团本已经开始了');
      m.ready = ev.on !== false;
    },
    start(S, ev, now, o, m) {
      const e = canStart(S, m.uid); if (e) return fail(o, e.code, e.text);
      if (S.st === 'rest') return beginPhase(S, S.phase + 1, now, o);
      const A = act(S);
      for (const x of A) x.rw = !ev.rw || ev.rw[x.uid] !== false;
      S.graph = S.mode === 'guide' || A.length < 2 ? 'guide' : 'normal';
      const plan = planTeams(S);   // canStart 已经检查过，这里一定 ok
      S.teams = plan.teams.map((u, i) => ({ id: i, members: u.slice() }));
      for (const t of S.teams) for (const u of t.members) mem(S, u).team = t.id;
      S.nTeams = S.graph === 'guide' ? 1 : S.teams.length;
      S.started = now;
      beginPhase(S, 0, now, o);
      const pr = A.filter(x => !x.rw);
      if (pr.length) note(o, 'all', `${names(S, pr.map(x => x.uid))} 本周 / 今天的次数用完了：这次是练习（没有奖励）`);
    },
    leave(S, ev, now, o, m) {
      if (S.st === 'lobby') {
        S.members = S.members.filter(x => x !== m);
        if (!S.members.length) return end(S, now, o, false, 'disband');
        if (S.leader === m.uid) { S.leader = S.members[0].uid; S.members[0].ready = true; }
        note(o, 'all', `${m.name} 离开了团本`);
        return;
      }
      const R = Object.values(S.runs).find(x => !x.end && x.by.includes(m.uid));
      if (R) leaveRun(S, R, m, 'lost', now, o);
      m.left = true; m.at = 'camp'; m.ready = false;
      if (!act(S).length) return end(S, now, o, false, 'abandon');
      if (S.leader === m.uid) S.leader = act(S)[0].uid;
      note(o, 'all', `${m.name} 离开了团本（这周的次数照扣）`);
    },
    online(S, ev, now, o, m) {
      const on = !!ev.on; if (m.online === on) return;
      m.online = on; m.offAt = on ? 0 : now;
    },
    mark(S, ev, now, o, m) {
      if (S.leader !== m.uid) return fail(o, 'leader', '只有团长能标记');
      if (ev.node != null && !nodeOf(S, ev.node)) return fail(o, 'node', '没有这个节点');
      // 标记目标：to = 队员 uid（只标这个人）| team = 队序号（整队）
      const tos = ev.team != null ? act(S).filter(x => x.team === (ev.team | 0)) : [mem(S, ev.to)].filter(x => x && !x.left);
      if (!tos.length) return fail(o, ev.team != null ? 'team' : 'member', ev.team != null ? '没有这个队' : '没有这个队员');
      for (const to of tos) { S.marks[to.uid] = ev.node || null; push(o, [to.uid], 'mark', ev.node || null, { by: m.uid }); }
    },
    // 团长分队（大厅、多队版）：to = 队员，team = 队序号（-1 = 取消分队）；每队最多 teamSize 人
    team(S, ev, now, o, m) {
      if (S.st !== 'lobby') return fail(o, 'state', '团本已经开始了，不能再分队');
      if (S.leader !== m.uid) return fail(o, 'leader', '只有团长能分队');
      if (S.tier !== 'team') return fail(o, 'tier', '只有多队版需要分队');
      const D = def(S), to = mem(S, ev.to), t = Number.isInteger(ev.team) ? ev.team : -1;
      if (!to || to.left) return fail(o, 'member', '没有这个队员');
      if (t < -1 || t >= (D.maxTeams || 4)) return fail(o, 'team', `最多 ${D.maxTeams || 4} 队`);
      if (t >= 0 && to.team !== t && act(S).filter(x => x.team === t).length >= (D.teamSize || 4)) return fail(o, 'size', `每队最多 ${D.teamSize || 4} 人`);
      to.team = t;
    },
    enter(S, ev, now, o, m) {
      if (S.st !== 'routes' && S.st !== 'final') return fail(o, 'state', S.st === 'rest' ? '休整中：等下一阶段开始' : '团本还没开始');
      const nd = nodeOf(S, ev.node); if (!nd) return fail(o, 'node', '没有这个节点');
      const N = S.nodes[nd.id], ids = [m.uid];
      for (const u of Array.isArray(ev.with) ? ev.with : []) if (u !== m.uid && !ids.includes(u)) ids.push(u);
      const team = ids.map(u => mem(S, u));
      if (team.some(x => !x || x.left)) return fail(o, 'with', '一起进的人不在这个团本里');
      for (const x of team) {
        if (!x.online) return fail(o, 'offline', `${x.name} 不在线`);
        if (x.at !== 'camp') return fail(o, 'busy', x === m ? '你已经在节点里了' : `${x.name} 正在别的节点里`);
        if (x.ero > now) return fail(o, 'erosion', `${x === m ? '你' : x.name}被侵蚀了：还要 ${Math.ceil((x.ero - now) / 1000)} 秒才能进节点`);
      }
      if (N.run) return fail(o, 'taken', '这个节点已经有人在打了');
      if (N.st !== 'open') return fail(o, 'locked', N.st === 'locked' ? '这个节点还没开放' : N.st === 'cool' ? '这个节点正在重生' : '这个节点已经打完了');
      // 分队：solo = 同一时间只能一队（一队里可以多人一起进）。两人版每人一队 → 和原来一样“不能两个人一起进”；多队版只能带本队的人（最终战除外）
      const cross = team.some(x => x.team !== m.team), D0 = def(S);
      if (nd.solo && (S.tier === 'team' ? cross : ids.length > 1)) return fail(o, 'solo', '这个节点必须分头打');
      if (S.tier === 'team') {
        if (cross) return fail(o, 'team', '只能带本队的队员一起进');
        if (ids.length > (D0.teamSize || 4)) return fail(o, 'size', `一队最多 ${D0.teamSize || 4} 人`);
      }
      // together（最终合流）：两人版 = 在线的人全部一起进；多队版 = 一整队一起进（一个房间最多 4 人，跨队同房还没做）
      if (nd.together && S.graph === 'normal' && !S.sub && act(S).some(x => x.online && !ids.includes(x.uid) && (S.tier !== 'team' || x.team === m.team))) return fail(o, 'together', S.tier === 'team' ? '这个节点要整队一起进（队长带队）' : '最终战要大家一起进（队长带队）');
      const PL = nd.pool ? S.pools[nd.pool] : null, P = phaseOf(S);
      const hp0 = PL ? PL.hp : S.cp[nd.id] ? S.cp[nd.id].hp : N.hpStart || 1;
      N.seen = true; N.until = nd.manual ? 0 : N.until;
      const gl = tlim(S, nd.groupLimit);
      if (gl && nd.group && !S.glim[nd.group]) { S.glim[nd.group] = { until: now + gl * 1000 }; note(o, 'all', `破坏之门开始计时：${Math.round(gl / 60)} 分钟内按顺序打完 4 扇门，不然全部重置`); }
      const pl = PL && tlim(S, (P.pools[nd.pool] || {}).limit);
      if (pl && !PL.until) { PL.until = now + pl * 1000; note(o, 'all', `${P.pools[nd.pool].name || '共享领主'}开始计时：${Math.round(pl / 60)} 分钟内打空共享血量`); }
      applyFx(S, nd, nd.enterFx, now, o);   // 进门就生效的效果（阴影之棺的虚弱）：这时还没有 run，不单独推送，随 entered 的 buffs 一起下发
      const rl = byMode(nd.runLimit, S);
      const R = { id: 'n' + (++S.runSeq), node: nd.id, by: ids, host: m.uid, t0: now, hp0, down: 0, end: null, endAt: 0, warned: 0, limit: rl ? now + rl * 1000 : 0, ph: PL ? hp0 : null, dealt: 0 };
      S.runs[R.id] = R; N.run = R.id; N.st = 'busy'; N.by = ids.slice(); N.hp = hp0; N.hpStart = 0;
      for (const x of team) x.at = nd.id;
      const rot = P.rot && nd.pool === P.rot.pool && nd.slot != null ? (nd.slot + S.rot) % P.rot.forms.length : -1;
      push(o, ids, 'entered', nd.id, { run: R.id, node: nd.id, name: nd.name, type: nd.type, dg: rot >= 0 ? P.rot.dgs[rot] : nd.dg || null, boss: nd.boss || null, host: m.uid, by: ids,
        scale: scale(S, nd.id, ids.length), buffs: activeBuffs(S, nd.id, now), gbuffs: S.gbuffs.map(b => ({ id: b.id, p: b.p, until: b.until })), team: m.team, chaos: S.chaos ? S.chaos.lv : 0, cp: S.cp[nd.id] || null, hpStart: hp0 < 1 ? hp0 : 0, order: N.order || 0,
        orderTurn: nd.type === 'order' && !S.sub ? myTurn(S, nd) : true, sub: S.sub, deadline: S.deadline,
        limit: R.limit, pool: PL ? { name: nd.pool, hp: PL.hp, until: PL.until, by: Object.assign({}, PL.by) } : null, form: rot >= 0 ? P.rot.forms[rot] : null });
      o.ack = { run: R.id };
    },
    hp(S, ev, now, o, m) {
      const R = runOf(S, ev, o, m, true); if (!R) return;
      const v = +ev.v; if (!(v >= 0 && v <= 1)) return fail(o, 'bad', '血量不对');
      const nd = nodeOf(S, R.node), N = S.nodes[R.node];
      if (N.st !== 'busy') return;
      N.hp = v;
      if (nd.type === 'order' && !S.sub && !R.warned && v <= 0.1 && !myTurn(S, nd)) { R.warned = 1; note(o, [m.uid], '还没轮到你：先别打倒守门人，等数字小的那边先倒', nd.id); }
      if (nd.type === 'sync') twinGuard(S, nd, now, o);
      const PL = nd.pool && S.pools[nd.pool];
      if (PL && R.ph != null) {
        let own = R.ph - v; const drop = S.guard.maxDrop;
        if (own > 0 && drop) own = Math.min(own, drop * Math.max(0, now - (R.pt || R.t0)) / 1000 + 1e-9);   // 防作弊：共享血量按掉血速度封顶（多报的部分下一次同步时补回给客户端）
        R.pt = now;
        if (own > 0) { poolBy(PL, R, Math.min(PL.hp, own)); PL.hp = Math.max(0, PL.hp - own); R.dealt += own; }
        R.ph = v; N.hp = PL.hp;
        if (PL.hp <= 1e-6) { R.down = R.down || now; poolClear(S, nd.pool, now, o); o.ack = { res: 'clear' }; return; }
        poolSync(S, nd.pool, o);
      }
    },
    // 走到领主房了（主机报）：needBoss 的节点因此开放（幻影之城 / 否定 / 压抑 / 忘却），扭曲的效果也只在这时生效
    boss(S, ev, now, o, m) {
      const R = runOf(S, ev, o, m, true); if (!R) return;
      const N = S.nodes[R.node]; if (N.st !== 'busy' || N.boss) return;
      N.boss = true; R.boss = now;
    },
    down(S, ev, now, o, m) { const R = runOf(S, ev, o, m, true); if (R) downRun(S, R, now, o); },
    clear(S, ev, now, o, m) {
      const R = runOf(S, ev, o, m, true); if (!R) return;
      const nd = nodeOf(S, R.node);
      // 没报过倒下就报通关 = 先按倒下处理（同步节点除外：它要等另一边，必须先单独报 down）
      if (!R.down) {
        if (nd.type === 'sync') return fail(o, 'nodown', '领主还没倒下');
        downRun(S, R, now, o);
        if (o.err || !R.down) return;
      }
      endRun(S, R, 'clear', now, o);
      o.ack = Object.assign({ res: 'clear' }, o.ack || {});
    },
    fail(S, ev, now, o, m) {
      const R = runOf(S, ev, o, m, false); if (!R) return;
      leaveRun(S, R, m, ev.v === 'lost' ? 'lost' : ev.v === 'dead' ? 'dead' : 'retreat', now, o);
    },
    death(S, ev, now, o, m) {
      const R = runOf(S, ev, o, m, false); if (!R) return;
      S.stats.deaths++;
      leaveRun(S, R, m, 'dead', now, o);
    },
    revive(S, ev, now, o, m) {
      const R = runOf(S, ev, o, m, false); if (!R) return;
      const k = m.uid + ':' + R.node, used = S.rev[k] || 0, per = byMode(def(S).perNode, S) || 2;
      if (S.lives <= 0 || used >= per) { push(o, [m.uid], 'life', R.node, { ok: false, why: S.lives <= 0 ? 'pool' : 'node', left: S.lives }); o.ack = { res: 'nolife' }; return; }
      S.lives--; S.rev[k] = used + 1;
      push(o, [m.uid], 'life', R.node, { ok: true, left: S.lives, nodeLeft: per - used - 1 });
      o.ack = { res: 'life' };
    },
    // 精英被击杀（主机报）：节点的 elites[id] = { fx: [...], once } 的效果生效（开关节点 / 全团增益 / 倒计时 / 钥匙…）；ev.v = 精英 id
    elite(S, ev, now, o, m) {
      const R = runOf(S, ev, o, m, true); if (!R) return;
      const nd = nodeOf(S, R.node), id = String(ev.v || ''), E = nd && nd.elites && own(nd.elites, id) ? nd.elites[id] : null;
      if (!E) return fail(o, 'elite', '这个节点没有这个精英');
      R.elite = R.elite || {};
      if (E.once !== false && R.elite[id]) { o.ack = { dup: true }; return; }
      R.elite[id] = (R.elite[id] || 0) + 1;
      applyFx(S, nd, E.fx, now, o);
      if (E.text) note(o, 'all', E.text, nd.id);
      o.ack = { res: 'elite' };
    },
    // 理智值变化（自己报：被打 / 机制扣、恢复）：单次限幅 ±40
    san(S, ev, now, o, m) {
      if (!def(S).sanity) return fail(o, 'bad', '这个团本没有理智值');
      const d = +ev.v; if (!Number.isFinite(d)) return fail(o, 'bad', '理智值不对');
      sanityAdd(S, m, Math.max(-40, Math.min(40, d)), o);
    },
    cp(S, ev, now, o, m) {
      const R = runOf(S, ev, o, m, true); if (!R) return;
      const nd = nodeOf(S, R.node); if (!nd.cp) return fail(o, 'bad', '这个节点没有存档点');
      const v = ev.v && typeof ev.v === 'object' ? ev.v : {}, hp = +v.hp, ph = v.ph;
      if (!(hp >= 0 && hp <= 1) || !Number.isInteger(ph) || ph < 0 || ph > 9) return fail(o, 'bad', '存档点数据不对');
      const prev = S.cp[R.node], base = prev ? Math.max(prev.at, R.t0) : R.t0, from = prev ? prev.hp : R.hp0, drop = S.guard.maxDrop;
      if (drop && hp < from - drop * Math.max(0, now - base) / 1000 - 1e-9) return fail(o, 'fast', '领主血量掉得太快了');
      S.cp[R.node] = { hp, ph, at: now };
      if (S.nodes[R.node].st === 'busy') S.nodes[R.node].hp = hp;
    },
  };

  function event(S, ev, now) {
    ensureMeta(S);
    const o = { S, fx: [], err: null, ack: null };
    const h = ev && typeof ev.t === 'string' && Object.prototype.hasOwnProperty.call(EV, ev.t) ? EV[ev.t] : null;
    if (!h) return fail(o, 'bad', '未知的团本事件');
    const m = mem(S, ev.uid);
    if (!m && ev.t !== 'join') return fail(o, 'member', '你不在这个团本里');
    if (m && m.left && ev.t !== 'online') return fail(o, 'left', '你已经离开了这个团本');
    if (!LIVE[S.st]) { if (ev.t === 'online') EV.online(S, ev, now, o, m); else fail(o, 'over', '团本已经结束了'); return o; }
    advance(S, now, o);
    if (!LIVE[S.st] && ev.t !== 'online') return fail(o, 'over', '团本已经结束了');
    h(S, ev, now, o, m);
    sweep(S, now, o);
    return o;
  }
  function tick(S, now) {
    ensureMeta(S);
    const o = { S, fx: [], err: null, ack: null };
    advance(S, now, o); sweep(S, now, o);
    return o;
  }
  // 服务端强制结束（没人开始的过期大厅等）
  function abort(S, now, why) {
    const o = { S, fx: [], err: null, ack: null };
    end(S, now, o, false, why);
    return o;
  }
  // 服务端停机后恢复：所有进行中的计时往后顺延停机的时长
  function shift(S, dt) {
    if (!dt || !LIVE[S.st]) return S;
    const f = v => v ? v + dt : v;
    S.deadline = f(S.deadline); S.restUntil = f(S.restUntil); S.phaseT0 = f(S.phaseT0);
    for (const N of Object.values(S.nodes)) { N.until = f(N.until); N.timer = f(N.timer); N.openT = f(N.openT); }
    for (const L of Object.values(S.glim || {})) L.until = f(L.until);
    for (const L of Object.values(S.pools || {})) L.until = f(L.until);
    for (const A of Object.values(S.aura || {})) A.next = f(A.next);
    for (const b of S.buffs) b.until = f(b.until);
    for (const b of S.gbuffs || []) b.until = f(b.until);
    for (const W of Object.values(S.win)) { W.until = f(W.until); W.t0 = f(W.t0); }
    for (const m of S.members) { m.ero = f(m.ero); m.offAt = f(m.offAt); }
    for (const R of Object.values(S.runs)) { R.t0 = f(R.t0); R.endAt = f(R.endAt); R.limit = f(R.limit); if (R.down) R.down += dt; }
    for (const c of Object.values(S.cp)) c.at = f(c.at);
    return S;
  }

  // ---- 给客户端看的状态（不含 RNG、挑战的内部记录）----
  function view(S) {
    ensureMeta(S);
    const P = phaseOf(S), nodes = {};
    for (const id of Object.keys(S.nodes)) { const N = S.nodes[id]; nodes[id] = { st: N.st, by: N.by.slice(), hp: N.hp, n: N.n, order: N.order, until: N.until, timer: N.timer, hpStart: N.hpStart, seen: !!N.seen, boss: !!N.boss };
      const R = N.run && S.runs[N.run]; if (R && !R.end && R.limit) nodes[id].limit = R.limit; }
    const aura = {}; for (const A of Object.values(S.aura || {})) aura[A.to] = (aura[A.to] || 0) + A.n;
    return { sid: S.sid, raid: S.raid, mode: S.mode, graph: S.graph, st: S.st, phase: P ? P.id : 0, leader: S.leader,
      created: S.created, started: S.started, ended: S.ended, why: S.why, deadline: S.deadline, restUntil: S.restUntil, lives: S.lives, sub: S.sub,
      tier: S.tier, nTeams: S.nTeams, teams: teamsOf(S), unassigned: S.st === 'lobby' && S.tier === 'team' ? act(S).filter(m => m.team < 0).map(m => m.uid) : [],
      keys: Object.assign({}, S.keys), gbuffs: S.gbuffs.map(b => ({ id: b.id, p: b.p, until: b.until, from: b.from })), chaos: S.chaos ? Object.assign({}, S.chaos) : null,
      members: S.members.map(m => ({ uid: m.uid, cid: m.cid, name: m.name, cls: m.cls, job: m.job, ready: m.ready, online: m.online, at: m.at, ero: m.ero, left: m.left, rw: m.rw, team: m.team, san: m.san, sanZ: m.sanZ || 0 })),
      nodes, buffs: S.buffs.map(b => ({ id: b.id, node: b.node, kind: b.kind, p: b.p, until: b.until, n: b.n || 0, from: b.from || null })),
      pools: JSON.parse(JSON.stringify(S.pools || {})), glim: JSON.parse(JSON.stringify(S.glim || {})), aura,
      rot: P && P.rot ? { i: S.rot, res: S.rot === P.rot.resonance, forms: formsNow(S) } : null,
      win: JSON.parse(JSON.stringify(S.win)), cp: JSON.parse(JSON.stringify(S.cp)), marks: Object.assign({}, S.marks),
      res: { phases: S.res.phases.slice(), used: Object.assign({}, S.res.used) }, stats: Object.assign({}, S.stats),
      flip: { state: S.flip.state, phase: S.flip.phase, openedAt: S.flip.openedAt, closedAt: S.flip.closedAt },
      loot: { mode: S.loot.mode, offers: Object.fromEntries(Object.entries(S.loot.offers).map(([id, O]) => [id, { id: O.id, item: O.item, source: O.source, mode: O.mode, status: O.status, winner: O.winner,
        minBid: O.minBid, bids: Object.assign({}, O.bids), price: O.price, fee: O.fee, pool: O.pool, settlement: O.settlement, delivery: O.delivery }])) } };
  }

  // ---- 数值（RA3 按它生成节点里的怪；组队房间的 ×1.6 由现有 coop 的 COOP_HP 负责，这里不重复乘）----
  function scale(S, nodeId, n) {
    const D = def(S), T = scaleOf(S), nd = nodeOf(S, nodeId) || {};
    return { mode: S.mode, guide: S.graph === 'guide', sub: S.sub, n: n || 1, teams: S.nTeams || 1, tier: S.tier, par: tmul(S), chaos: S.chaos ? S.chaos.lv : 0, hp: T.hp, atk: T.atk, mech: T.mech, cur: T.cur, gear: T.gear,
      penalty: !!T.penalty && S.graph === 'normal', pen: T.pen ?? 1, lvl: nd.type === 'final' ? D.lvl.final : D.lvl.node };
  }

  // ---- 每天 / 每周次数（按角色；06:00 换日，周四 06:00 换周；tz = 时区，东八区 480 分钟）----
  const dayNo = (t, tz) => Math.floor((t + (tz ?? BJ) * 60000 - RESET) / DAY);
  const weekNo = (t, tz) => Math.floor(dayNo(t, tz) / 7);
  // rec = { day, dn, week, wn }（上次记录的日 / 周编号和用掉的次数；没有记录传 null）
  function limits(raid, rec, now, tz) {
    const L = (defOf(raid) || {}).limits || { day: 1, week: 2 }, d = dayNo(now, tz), w = weekNo(now, tz), z = (tz ?? BJ) * 60000;
    const dn = rec && rec.day === d ? rec.dn | 0 : 0, wn = rec && rec.week === w ? rec.wn | 0 : 0;
    const dayLeft = Math.max(0, L.day - dn), weekLeft = Math.max(0, L.week - wn);
    return { day: d, week: w, dn, wn, dayLeft, weekLeft, ok: dayLeft > 0 && weekLeft > 0, max: { day: L.day, week: L.week },
      nextDay: (d + 1) * DAY + RESET - z, nextWeek: (w + 1) * 7 * DAY + RESET - z };
  }
  function consume(raid, rec, now, tz) {
    const L = limits(raid, rec, now, tz);
    return L.ok ? { day: L.day, dn: L.dn + 1, week: L.week, wn: L.wn + 1 } : null;
  }

  // ---- 奖励（RA3 填 RAID_DEFS[*].rewards 的内容；服务端领奖时调用，结果存库，重复领返回同一份）----
  const range = (v, r) => Array.isArray(v) ? v[0] + Math.floor(r() * (v[1] - v[0] + 1)) : (v | 0) || 1;
  function card(RW, c, sc, r) {
    if (!c) return null;
    if (c.table) {
      const T = c.table.map(([w, x]) => [w * (x && x.gear ? sc.gear : 1), x]), sum = T.reduce((a, [w]) => a + w, 0);
      let k = r() * sum;
      for (const [w, x] of T) { if ((k -= w) < 0) return card(RW, x, sc, r); }
      return card(RW, T[T.length - 1][1], sc, r);
    }
    if (c.cur) return { key: RW.cur, n: Math.max(1, Math.round(range(c.cur, r) * sc.cur)) };
    if (c.pick) return { key: c.pick[Math.floor(r() * c.pick.length)], n: range(c.n || 1, r) };
    if (c.key) return { key: c.key, n: range(c.n || 1, r) };
    return null;
  }
  function rollReward(S, uid, phaseId, r) {
    ensureMeta(S);
    r = r || Math.random;
    const D = def(S), RW = D.rewards || {}, T = scaleOf(S), sc = { cur: T.cur * (S.chaos && D.chaos && D.chaos.cur ? D.chaos.cur[S.chaos.lv - 1] ?? 1 : 1), gear: T.gear };
    if (typeof RW.roll === 'function') return RW.roll({ S, uid, phase: phaseId, rnd: r, scale: sc, mode: S.mode });
    return { phase: phaseId, cards: (RW['p' + phaseId] || []).map(c => card(RW, c, sc, r)).filter(Boolean) };
  }

  // ---- 翻牌生命周期（结算阶段的移动 / 战斗锁由客户端消费 flip.state） ----
  function flipOpen(S, uid, phaseId, now) {
    ensureMeta(S); const m = mem(S, uid), p = Number(phaseId);
    if (!m || m.left) return { ok: false, code: 'member', text: '你不在这个团本里' };
    if (!S.res.phases.includes(p)) return { ok: false, code: 'phase', text: '这个阶段还没通关' };
    const key = String(uid);
    // 兼容旧版本已经失败的会话：旧存档没有保留失败前的翻牌元数据，
    // 但阶段记录仍然可信，按请求的已完成阶段重建可补领的牌面。
    if (S.st === 'failed' && S.flip.state === 'none' && S.res.phases.includes(p)) S.flip = { state: 'ready', phase: p, openedAt: 0, closedAt: 0, cards: {} };
    if (S.flip.state === 'none' || S.flip.phase !== p) return { ok: false, code: 'flip', text: '翻牌阶段不可用' };
    const old = S.flip.cards[key];
    if (old && old.closedAt) return { ok: false, code: 'closed', text: '你已经完成本阶段翻牌' };
    // 每个队员都有自己的牌面和关闭状态；一名队员完成后，其他队员仍可打开自己的结算窗口。
    if (S.flip.state === 'ready' || S.flip.state === 'closed') { S.flip.state = 'open'; S.flip.openedAt ||= now; }
    if (!S.flip.cards[key]) S.flip.cards[key] = { phase: p, openedAt: now, picks: [] };
    return { ok: true, state: S.flip.state, phase: p, picks: S.flip.cards[key].picks.slice() };
  }
  function flipSetReward(S, uid, phaseId, reward) {
    ensureMeta(S); const p = Number(phaseId), c = S.flip.cards[String(uid)];
    if (!c || S.flip.phase !== p || S.flip.state !== 'open' || !reward || !Array.isArray(reward.cards)) return { ok: false, code: 'flip', text: '请先打开翻牌阶段' };
    if (!c.rewardCards) c.rewardCards = JSON.parse(JSON.stringify(reward.cards));
    return { ok: true };
  }
  function flipPick(S, uid, phaseId, index, now, r) {
    ensureMeta(S); const p = Number(phaseId), key = String(uid), c = S.flip.cards[key];
    if (S.flip.state !== 'open' || S.flip.phase !== p || !c) return { ok: false, code: 'flip', text: '请先进入翻牌阶段' };
    const i = index | 0, n = Math.max(1, ((def(S).rewards || {})['p' + p] || []).length);
    if (i < 0 || i >= n) return { ok: false, code: 'card', text: '没有这张牌' };
    if (c.picks.length >= flipLimit(p)) return { ok: false, code: 'limit', text: `本阶段只能翻 ${flipLimit(p)} 张牌` };
    if (c.picks.some(x => x.index === i)) return { ok: false, code: 'dup', text: '这张牌已经翻开了' };
    const reward = (c.rewardCards && c.rewardCards[i]) || rollReward(S, uid, p, r || Math.random).cards[i] || null;
    c.picks.push({ index: i, reward, at: now });
    return { ok: true, index: i, reward, picks: c.picks.slice() };
  }
  function flipClose(S, uid, phaseId, now) {
    ensureMeta(S); const p = Number(phaseId), c = S.flip.cards[String(uid)];
    if (!c || S.flip.phase !== p || (S.flip.state !== 'open' && S.flip.state !== 'ready')) return { ok: false, code: 'flip', text: '翻牌阶段不可用' };
    if (c.picks.length < flipLimit(p)) return { ok: false, code: 'limit', text: `请先选择 ${flipLimit(p)} 张牌` };
    c.closedAt = now;
    const allClosed = act(S).filter(m => m.rw !== false).every(m => S.flip.cards[String(m.uid)] && S.flip.cards[String(m.uid)].closedAt);
    if (allClosed) { S.flip.state = 'closed'; S.flip.closedAt = now; }
    return { ok: true, phase: p, closed: allClosed };
  }

  // ---- 组队装备分配（可供普通协作副本和团本掉落共用） ----
  function lootCandidates(S) { return S.members.filter(m => !m.left && m.online).map(m => m.uid).sort((a, b) => String(a).localeCompare(String(b))); }
  function lootParticipants(S) { return S.members.filter(m => !m.left).map(m => m.uid).sort((a, b) => String(a).localeCompare(String(b))); }
  function lootMode(S) { ensureMeta(S); return S.loot.mode; }
  function lootWallet(S, uid) {
    ensureMeta(S); const W = S.loot.wallets[String(uid)];
    return W ? { gold: W.gold, vault: W.vault, cap: W.cap, mail: W.mail.slice() } : null;
  }
  function wallet(S, uid) { ensureMeta(S); return S.loot.wallets[String(uid)] || null; }
  function walletEffect(S, uid, kind, amount, offer) {
    const W = wallet(S, uid);
    const mail = W && (kind === 'share' || kind === 'refund-mail') && W.mail.length ? W.mail[W.mail.length - 1] : null;
    return { uid, kind, amount: Math.max(0, Math.floor(amount || 0)), offer: offer || null, wallet: W ? { gold: W.gold, vault: W.vault, cap: W.cap } : null, mail };
  }
  function takeWallet(S, uid, amount, source) {
    const W = wallet(S, uid), n = Math.max(0, Math.floor(Number(amount) || 0));
    if (!W || n <= 0) return null;
    if (n > W.gold + W.vault) return null;
    let gold = 0, vault = 0;
    if (source === 'vault') { vault = Math.min(W.vault, n); gold = n - vault; }
    else { gold = Math.min(W.gold, n); vault = n - gold; }
    W.gold -= gold; W.vault -= vault;
    return { amount: n, gold, vault };
  }
  function returnWallet(S, uid, amount, now, offer) {
    const W = wallet(S, uid), n = Math.max(0, Math.floor(Number(amount) || 0));
    if (!W || n <= 0) return null;
    // 官方：退回金额若超过角色携带上限，整笔通过邮件退回，而不是部分塞进钱包。
    if (W.gold + n > W.cap) {
      const mail = { kind: 'gold', amount: n, reason: 'raid-auction-refund', offer: offer || null, at: now };
      W.mail.push(mail);
      return { ...walletEffect(S, uid, 'refund-mail', n, offer), mail, at: now };
    }
    W.gold += n;
    return { ...walletEffect(S, uid, 'refund', n, offer), at: now };
  }
  function auctionRows(S, O) {
    // 已经出过价的队员即使在结算前掉线 / 离开，托管中的最高价仍然有效；
    // 只有新的出价人要求在线，所以这里使用掉落生成时的参战快照。
    const ids = (O.participants || lootParticipants(S)).map(String);
    return Object.entries(O.bids || {}).filter(([uid, n]) => ids.includes(String(uid)) && Number(n) > 0)
      .map(([uid, n]) => ({ uid, amount: Math.floor(Number(n)) }))
      .sort((a, b) => b.amount - a.amount || String(a.uid).localeCompare(String(b.uid)));
  }
  function setLootMode(S, uid, mode) {
    ensureMeta(S); mode = mode === 'free' ? 'owner' : mode;
    if (!LOOT_MODES.includes(mode)) return { ok: false, code: 'mode', text: '未知的分配方式' };
    if (S.leader !== uid) return { ok: false, code: 'leader', text: '只有队长能设置拾取分配' };
    if (S.st !== 'lobby') return { ok: false, code: 'state', text: '开始后不能更改拾取分配' };
    S.loot.mode = mode; return { ok: true, mode };
  }
  function lootOffer(S, item, source, now, mode) {
    ensureMeta(S); const M = mode === 'free' ? 'owner' : (mode || S.loot.mode), ids = lootCandidates(S);
    if (!LOOT_MODES.includes(M)) return { ok: false, code: 'mode', text: '未知的分配方式' };
    if (!ids.length) return { ok: false, code: 'party', text: '没有在线队员可分配' };
    const id = 'loot' + (++S.loot.seq), owner = ids.includes(source) ? source : S.leader;
    const minBid = Math.max(1, Math.floor(Number(item && (item.minBid ?? item.bidMin)) || 0));
    const O = { id, item: item && JSON.parse(JSON.stringify(item)), source: owner, mode: M, status: 'pending', winner: null,
      minBid, participants: lootParticipants(S), bids: {}, escrow: {}, bidHistory: [], refunds: [], createdAt: now };
    if (M === 'owner') { O.status = 'awarded'; O.winner = owner; }
    else if (M === 'random') { O.status = 'awarded'; O.winner = ids[Math.floor(rnd(S) * ids.length)]; }
    S.loot.offers[id] = O; S.loot.history.push(id); if (S.loot.history.length > 200) S.loot.history.shift();
    return { ok: true, offer: JSON.parse(JSON.stringify(O)) };
  }
  function lootAssign(S, uid, id, to, now) {
    ensureMeta(S); const O = S.loot.offers[id], ids = lootCandidates(S);
    if (!O) return { ok: false, code: 'loot', text: '掉落不存在' };
    if (O.mode !== 'leader' || uid !== S.leader) return { ok: false, code: 'leader', text: '只有队长能分配这件装备' };
    if (!ids.includes(to)) return { ok: false, code: 'member', text: '接收者不在队伍中' };
    if (O.status !== 'pending') return { ok: false, code: 'done', text: '这件装备已经分配' };
    O.status = 'awarded'; O.winner = to; O.assignedAt = now; return { ok: true, offer: JSON.parse(JSON.stringify(O)) };
  }
  function lootBid(S, uid, id, amount, now, opt) {
    ensureMeta(S); const O = S.loot.offers[id], ids = lootCandidates(S), key = String(uid), n = Math.max(0, Math.floor(Number(amount) || 0));
    if (!O) return { ok: false, code: 'loot', text: '掉落不存在' };
    if (O.mode !== 'auction' || O.status !== 'pending') return { ok: false, code: 'auction', text: '这件装备不在竞拍中' };
    if (!ids.some(x => String(x) === key) || !n) return { ok: false, code: 'bid', text: '竞价无效' };
    const rows = auctionRows(S, O), high = rows[0], old = O.bids[key] && Math.floor(Number(O.bids[key]));
    // 最高价者不能追加出价；出价被超后旧托管会在同一事务里退回，随后可以重新竞拍。
    if (high && String(high.uid) === key) return { ok: false, code: 'highest', text: '你已经是最高出价者，不能追加竞价' };
    const floor = Math.max(O.minBid || 1, high ? high.amount + 1 : 0);
    if (n < floor) return { ok: false, code: 'minimum', text: `出价必须至少 ${floor.toLocaleString('en-US')} G` };
    const limitWallet = wallet(S, uid);
    if (!limitWallet || n > limitWallet.cap) return { ok: false, code: 'cap', text: `出价不能超过角色金币携带上限 ${Number(limitWallet && limitWallet.cap || AUCTION_GOLD_CAP).toLocaleString('en-US')} G` };
    // 先验证金额，避免一笔无效的低价出手把自己的旧托管意外退回。
    // 正常流程不会留下非最高旧价；兼容旧会话时仍将它完整退回，再扣本次新价。
    const oldHeld = old > 0 ? (O.escrow[key] && O.escrow[key].amount || old) : 0;
    const available = wallet(S, uid);
    const freeAfterOld = available ? available.gold + available.vault + oldHeld : 0;
    if (!available || n > freeAfterOld) return { ok: false, code: 'funds', text: '金币和账号金库余额不足' };
    const effects = [];
    if (oldHeld) {
      delete O.bids[key]; delete O.escrow[key];
      const back = returnWallet(S, uid, oldHeld, now, O.id); if (back) { O.refunds.push(back); effects.push(back); }
    }
    const debit = takeWallet(S, uid, n, opt && opt.source);
    if (!debit) return { ok: false, code: 'funds', text: '金币和账号金库余额不足' };
    // 新出价取代旧最高价；旧最高价的整笔托管立即退回，超过携带上限则整笔进邮件。
    if (high) {
      const previous = String(high.uid), held = O.escrow[previous] && O.escrow[previous].amount || high.amount;
      delete O.bids[previous]; delete O.escrow[previous];
      const back = returnWallet(S, previous, held, now, O.id);
      if (back) { O.refunds.push(back); effects.push(back); }
    }
    O.bids[key] = n; O.escrow[key] = debit; O.bidAt = now;
    O.bidHistory.push({ uid, amount: n, at: now });
    effects.unshift(walletEffect(S, uid, 'debit', n, O.id));
    return { ok: true, id, bids: Object.assign({}, O.bids), current: { uid, amount: n }, effects };
  }
  function lootResolve(S, id, now) {
    ensureMeta(S); const O = S.loot.offers[id]; if (!O) return { ok: false, code: 'loot', text: '掉落不存在' };
    if (O.status !== 'pending') return { ok: true, offer: JSON.parse(JSON.stringify(O)) };
    if (O.mode !== 'auction') return { ok: false, code: 'loot', text: '只有竞拍掉落需要结算' };
    const rows = auctionRows(S, O);
    if (!rows.length) {
      O.status = 'destroyed'; O.destroyedAt = now; O.resolvedAt = now;
      O.settlement = { destroyed: true, participants: (O.participants || lootParticipants(S)).slice() };
      return { ok: true, offer: JSON.parse(JSON.stringify(O)), destroyed: true };
    }
    O.status = 'awarded'; O.winner = rows[0].uid; O.price = rows[0].amount; O.resolvedAt = now;
    const fee = Math.max(0, Math.floor(O.price * (Number.isFinite(Number(O.feeRate)) ? Number(O.feeRate) : AUCTION_FEE_RATE)));
    const pool = Math.max(0, O.price - fee), participants = (O.participants || lootParticipants(S)).slice(), shares = {};
    if (participants.length) {
      const base = Math.floor(pool / participants.length), rem = pool - base * participants.length;
      participants.forEach((uid, i) => {
        const share = base + (i < rem ? 1 : 0); shares[String(uid)] = share;
        if (share) { const W = wallet(S, uid); const mail = { kind: 'gold', amount: share, reason: 'raid-auction-share', offer: O.id, at: now }; W.mail.push(mail); }
      });
    }
    O.fee = fee; O.pool = pool; O.settlement = { fee, pool, shares, participants };
    O.delivery = 'mail';
    return { ok: true, offer: JSON.parse(JSON.stringify(O)), effects: participants.map(uid => walletEffect(S, uid, 'share', shares[String(uid)] || 0, O.id)) };
  }

  return { VER, defs: RAID_DEFS, LIVE, LOOT_MODES, flipLimit, flipComplete, defOf, graph, init, event, tick, abort, view, scale, canStart, limits, consume, dayNo, weekNo, rollReward,
    flipOpen, flipSetReward, flipPick, flipClose, lootMode, setLootMode, lootCandidates, lootParticipants, lootWallet, lootOffer, lootAssign, lootBid, lootResolve, shift,
    TEAM_COLORS, planTeams, teamOf, teamsOf, capacity, scaleOf, AUCTION_GOLD_CAP, AUCTION_FEE_RATE };
})();
const raidInit = RAID_CORE.init, raidEvent = RAID_CORE.event, raidTick = RAID_CORE.tick;
