# 脚本索引

> 本文件由 `node tools/gen_scripts_index.mjs` 生成，**不要手改**（改脚本文件头的第一行说明，再重新生成）。
> `node tools/gen_scripts_index.mjs --check` 会检查本文件是否最新、每个脚本是否写了文件头说明。
> 新来的人先读 [`../CLAUDE.md`](../CLAUDE.md)（项目地图与常用命令）和 [`README.md`](README.md)（文档索引）。

## 构建

`node build.mjs` 把 `src/` 按 `src/ORDER` 拼成网页版 `dist/web/` 和离线单文件 `dist/dawnbreak.html`。

### 构建（1）

| 脚本 | 作用 |
|---|---|
| [`build.mjs`](../build.mjs) | 构建：把 src/ 下的脚本按 src/ORDER 顺序拼进一个 <script>（共享同一作用域），输出两个版本： |

## 运维与分析工具（`tools/`）

部署、数据体检、技能范围检查、服务器管理。部署前先读 `README.md` 的“部署”一节：生产与开发服务器不能混用。

### 部署（1）

| 脚本 | 作用 |
|---|---|
| [`tools/deploy.sh`](../tools/deploy.sh) | 部署到线上（dnf.cc.l-hate.com）。前端：构建 → rsync dist/web（version.json 最后传）→ 核对首页和版本号一致；服务端：先备份数据库再装。 |

### 服务器管理（`tools/admin/`）（5）

| 脚本 | 作用 |
|---|---|
| [`tools/admin/admin.sh`](../tools/admin/admin.sh) | 线上运维一条命令（服务器 cc）。写操作前自动备份数据库；写存档另外留一份 save_history（可从管理员后台恢复）。 |
| [`tools/admin/amp.mjs`](../tools/admin/amp.mjs) | 把某个角色身上的装备（武器 / 防具 / 首饰 / 特殊装备，不含称号和时装）全部改成“增幅 +N、红字 = 主属性”，耐久补满 |
| [`tools/admin/maxout.mjs`](../tools/admin/maxout.mjs) | 把云端存档拉下来的 cloud.json 里的角色一键练满（等级 / 装备 / 技能 / 转职），写成 maxed.json；一般由 tools/admin/admin.sh 调用 |
| [`tools/admin/remote.js`](../tools/admin/remote.js) | 在服务器上跑的数据库小工具（由 tools/admin/*.sh 通过 ssh 调用，用服务端自带的 node 运行）。 |
| [`tools/admin/verify_save.mjs`](../tools/admin/verify_save.mjs) | 校验 maxout 的结果：把 maxed.json 里每个角色进城一次、截个人信息图，确认存档能正常加载 |

### 数据与资源体检（7）

| 脚本 | 作用 |
|---|---|
| [`tools/asset_audit.mjs`](../tools/asset_audit.mjs) | 素材盘点：找出 art/final 里游戏从来不用的文件（docs/ASSET_AUDIT.md）。先 node build.mjs（data / trace 要用构建好的页面） |
| [`tools/boss_inventory.mjs`](../tools/boss_inventory.mjs) | 领主清单 + 查重（docs/BOSS_PLAN.md §4.2 P0-C）：在 Node 的 vm 里把 src/ 跑一遍（照 tools/item_catalog.mjs 的做法，浏览器接口换成替身）， |
| [`tools/dup_globals.mjs`](../tools/dup_globals.mjs) | 同名全局函数检查：src/ 按 src/ORDER 拼成一个全局作用域，顶层 function 重名不会报错，后加载的悄悄覆盖前面的 |
| [`tools/gen_scripts_index.mjs`](../tools/gen_scripts_index.mjs) | 脚本索引生成器：扫描 build.mjs / tools / test / server/test / art/tools 里每个脚本的文件头注释，按文件名规则分类，写成 docs/SCRIPTS.md |
| [`tools/item_catalog.mjs`](../tools/item_catalog.mjs) | 物品 / 职业目录（给后台管理 /admin 的物品选择器和服务端的物品 key 校验用）： |
| [`tools/skillgrid.mjs`](../tools/skillgrid.mjs) | 技能范围格子体检：人物站在 x=300，木桩摆成 17 列（身后 400 到身前 900）× 5 行（纵深 ±90），每个技能放一次，记下打到了哪些格子， |
| [`tools/srv_load.mjs`](../tools/srv_load.mjs) | 服务端压力测量（只在本机跑，不要对线上用）：独立进程起一个临时服务端，用假客户端模拟 R 个组队房间（每间 M 人，按实测的消息大小 / 频率发组队流量） |

## 测试（`test/`）

全部是无头 Chrome 端到端测试，公共部分在 `lib.mjs`。先 `node build.mjs`（测试读构建产物）；多个测试不要并行开浏览器。入口：`node test/flow.mjs`（冒烟，必跑）、`sh test/quick.sh`（快速回归）、`sh test/all.sh`（完整回归）、`node test/affected.mjs`（按改动文件挑测试）。

### 回归入口与公共库（11）

| 脚本 | 作用 |
|---|---|
| [`test/_shot.mjs`](../test/_shot.mjs) | 临时截图小工具：node test/_shot.mjs "<URL 参数>" <输出.png> [等待毫秒]，加 JS=... 环境变量可在截图前执行脚本 |
| [`test/affected.mjs`](../test/affected.mjs) | 只跑受影响的测试：按改动的文件挑测试，默认 2 路并行、低优先级，不卡电脑 |
| [`test/all.sh`](../test/all.sh) | 全套回归（主线程合并验收用）：依次运行所有测试，逐个记录退出码，最后汇总。 |
| [`test/combat_all.sh`](../test/combat_all.sh) | 战斗与动作的全套回归：构建 → 机制 → 全部技能 → 决斗场 → 帧率 → 机器人通关。每项的结尾输出 EXIT=<退出码> |
| [`test/lib.mjs`](../test/lib.mjs) | 无头浏览器测试公共部分：启动 Chrome（headless）、收集控制台/页面错误、分析截图亮度 |
| [`test/lib_bestkit.mjs`](../test/lib_bestkit.mjs) | 「同级最好的一套史诗」搜索（页面里跑）：test/gear60.mjs power 和 test/region.mjs 的 GEAR=epic 共用 |
| [`test/lib_raidmech.mjs`](../test/lib_raidmech.mjs) | 团本领主机制测试的公共工具（test/raid_mech_lab.mjs、test/raid_bosses.mjs 共用）：确定性推进 SIM、摆位 / 打一下 T、每个谜题的“正确操作” SOLVE |
| [`test/net_lib.mjs`](../test/net_lib.mjs) | 联机测试公共部分：临时数据库起一个本地服务端（顺带托管 dist/web），开 1~4 个互相隔离的玩家（同一个 Chrome 进程里的独立上下文，各自的 localStorage） |
| [`test/priest_coop_lib.mjs`](../test/priest_coop_lib.mjs) | 驱魔师 / 复仇者组队可见性检查的公共部分（test/exorcist.mjs coop、test/avenger.mjs coop 用）： |
| [`test/quick.sh`](../test/quick.sh) | 快速回归（主线程合并一批后用，约 9 分钟；平时开发只跑受影响的测试：node test/affected.mjs）：只挑一分钟以内的核心测试，分 6 组并行跑。 |
| [`test/testlock.mjs`](../test/testlock.mjs) | 测试并发名额（2026-10-01 用户：电脑全给你用，可以同时跑 3 套测试）：test/affected.mjs、test/boss.mjs、test/quick.sh 共用 |

### 联机与服务端（28）

| 脚本 | 作用 |
|---|---|
| [`test/acct.mjs`](../test/acct.mjs) | 点券 / 魔盒碎片 / 礼包币账号共享（老存档合并）+ 没名字的角色补默认名 + 角色选择“改名” |
| [`test/admin_console.mjs`](../test/admin_console.mjs) | 后台管理页面 /admin/ 的无头浏览器测试：本地服务端（临时数据库，托管 dist/web）→ 普通玩家登录被拒 → 管理员登录 → 逐个页签打开并截图 → |
| [`test/boss_coop.mjs`](../test/boss_coop.mjs) | test/boss.mjs 的 coop 部分：2 个真实客户端（net_lib.mjs）组队，逐个地下城传到领主房，主机逐招强制放、逐阶段压血， |
| [`test/coop_mail.mjs`](../test/coop_mail.mjs) | 竞拍邮件单测（不开浏览器）：在 Node VM 里抽出 src/net/coop.js 的 coop 对象，验证金币 / 物品竞拍邮件的持久化、领取与背包满时保留 |
| [`test/enchantress_coop.mjs`](../test/enchantress_coop.mjs) | 小魔女 · 永恒的占据（组队才能用）：2 个玩家真联机 —— 队员死亡倒计时里，小魔女放永恒的占据，队员原地复活（不花复活币）。node test/enchantress_coop.mjs |
| [`test/findfriend.mjs`](../test/findfriend.mjs) | 寻找好友：按角色名加好友 → 好友列表“前往”（跨区域自动走到好友身边）→ 聊天 /找 名字 → 方向键取消 |
| [`test/liveupdate.mjs`](../test/liveupdate.mjs) | 在线更新（net/liveupdate.js）：本地服务端托管一份临时网页版（index.html 复制、素材链接到 dist/web/assets），改 index.html 的 BUILD_ID + version.json 模拟一次部署 |
| [`test/mp_abyss.mjs`](../test/mp_abyss.mjs) | 联机深渊回归（魔界深渊 abyss_siroco）：2 个真实客户端组队，Lv60 狂战士（三觉 / 技能学满 / 最强装备 +12），刷图冷却 ×0.34（冷却减少装备叠满后的实测值）， |
| [`test/mp_bosses.mjs`](../test/mp_bosses.mjs) | 联机领主自定义机制（REGION_HOOKS / 房间机关，net/coop_mech.js 的 hook 事件）：2 个真实客户端组队进比尔马克帝国试验场， |
| [`test/mp_bossprims.mjs`](../test/mp_bossprims.mjs) | 联机：领主差异化 P0 的新原语（docs/BOSS_SPEC.md §7）——2 个真实客户端组队进比尔马克帝国试验场，第一个房间清完后由主机刷领主、强制出招 / 启动机制。 |
| [`test/mp_coop.mjs`](../test/mp_coop.mjs) | 联机 M3：组队刷图（默认 2 人，N=3 / N=4 可以多开）：组队 → 队长在门口进图 → 队员自动跟进 → 机器人一起清房 → 领主死亡 → 各自结算翻牌 → 回城 |
| [`test/mp_coop_drop.mjs`](../test/mp_coop_drop.mjs) | 联机 M3/M5：组队刷图里的断线（2 个玩家；测试服务器的掉线宽限期是 4 秒） |
| [`test/mp_coop_more.mjs`](../test/mp_coop_more.mjs) | 联机：组队刷图的手感与规则（2 个玩家，默认模拟 80ms 下行延迟） |
| [`test/mp_duel.mjs`](../test/mp_duel.mjs) | 联机 M4：好友决斗（2 个玩家）：点玩家发起 → 对方接受 → 双方进决斗场 → 对方的键盘输入驱动主机上的角色 → 打完三局两胜 → 各自回城 + pvpResult |
| [`test/mp_duel_lag.mjs`](../test/mp_duel_lag.mjs) | 好友决斗的操作延迟（docs/NETWORK.md「决斗的操作延迟」）：对方（队员）按下攻击 / 技能 → 自己屏幕上自己的角色开始出招，隔了多少毫秒。 |
| [`test/mp_fighter.mjs`](../test/mp_fighter.mjs) | 组队刷图 · 男格斗家（B9）：鬼剑士当队长（主机）+ 柔道家当队员，一起进地下城 |
| [`test/mp_party_hud.mjs`](../test/mp_party_hud.mjs) | 组队：按角色名邀请 → 对方接受 → 城镇左侧队伍面板显示 → 点队员移交队长 / 请离；提示走屏幕横幅 |
| [`test/mp_perf.mjs`](../test/mp_perf.mjs) | 联机卡顿排查（docs/PERF.md）：本地服务端 + 2 个真实客户端组队进 Lv60 地下城，满级转职 / 三觉 / 最强史诗 + 武器 +13~16， |
| [`test/mp_raid.mjs`](../test/mp_raid.mjs) | 两人团本（RA2）：2 个真实客户端（alice 队长、bob），普通模式从头打到尾（本地服务端 DNF_RAID_FAST=1 + 页面 ?raidfast） |
| [`test/mp_restart.mjs`](../test/mp_restart.mjs) | 联机：服务器重启（kill -9 再拉起，同端口同数据库）后，组队刷图和好友决斗都接着玩，不回城（2 个玩家） |
| [`test/mp_smooth.mjs`](../test/mp_smooth.mjs) | 组队刷图：网络抖动下队友 / 怪物动得顺不顺（docs/PERF.md）。服务端下行加 LAG 延迟 + 0~JITTER 的随机抖动， |
| [`test/mp_town.mjs`](../test/mp_town.mjs) | 联机 M2：城镇同屏 + 聊天 + 好友 + 组队邀请（3 个玩家页面） |
| [`test/net_account.mjs`](../test/net_account.mjs) | 联机 M1：账号与云存档（2 个玩家页面） |
| [`test/svc_api.mjs`](../test/svc_api.mjs) | 社交服务接口测试（不开浏览器）：拍卖（上架 / 幂等 / 购买 / 邮件交割 / 到期退回 / 下架）、邮件（领取幂等 / 好友寄信 / 删除）、 |
| [`test/svc_guild.mjs`](../test/svc_guild.mjs) | 公会 + 成就 端到端测试：本机真实服务端 + 临时数据库，1 个 Chrome 里同时最多 2 个玩家（alice / bob），全部走真实界面 |
| [`test/svc_guild_api.mjs`](../test/svc_guild_api.mjs) | 公会 / 成就点排行 接口测试（不开浏览器，真实服务端 + 临时数据库）：创建（幂等 / 重名 / 徽章校验）、申请 / 审批、邀请 / 接受、职位 / 转让 / 踢人 / 离开 / 解散、 |
| [`test/svc_host.mjs`](../test/svc_host.mjs) | 社交服务测试的服务端：用联机组的真实服务端（server/index.js 的 start()）在临时数据库上起一个本机实例，顺带托管网页版 dist/web |
| [`test/svc_play.mjs`](../test/svc_play.mjs) | 社交服务端到端测试：本机起真实服务端（临时数据库，test/svc_host.mjs），1 个无头浏览器里开 2 个互相隔离的玩家上下文（最多同时 2 个，测完立刻关） |

### 决斗与 PvP（7）

| 脚本 | 作用 |
|---|---|
| [`test/arena.mjs`](../test/arena.mjs) | 决斗场排位赛（2 个玩家）：窗口里点“开始匹配” → 两个真人互相匹配 → 好友决斗同一套联机流程 → 结算积分 → 回城； |
| [`test/duel.mjs`](../test/duel.mjs) | 决斗场测试：AI 对 AI 自动打完三局两胜（?duel=A&vs=B&auto），统计双方施放的技能、造成的伤害、受身 / 后跳 / 后跳-强化次数、抓取、保护触发、帧率 |
| [`test/duel_rules.mjs`](../test/duel_rules.mjs) | 决斗场规则单测（B9，docs/PVP.md §5）：逐帧 step()、不渲染，约 10 秒 |
| [`test/duel_stats.mjs`](../test/duel_stats.mjs) | 决斗节奏统计（B9）：一局打多久（击杀用时 / 超时比例）、连招多长（每次连招的段数 / 时长 / 伤害占 HP 比例），AI 难度 3 循环赛，无渲染快进 |
| [`test/duel_wakeup.mjs`](../test/duel_wakeup.mjs) | 决斗“一定站得起来”（2026-09-30 线上反馈：靠近阿修罗就一直被打在地上站不起来）：逐帧 step()、不渲染 |
| [`test/fighter_pvp.mjs`](../test/fighter_pvp.mjs) | 男格斗家（B9）决斗：AI 用得出各转职的主要技能 + 抓取在决斗里公平（抓取保护 / 强制硬直上限 / 没有无限连）+ 决斗表登记 |
| [`test/pvp_balance.mjs`](../test/pvp_balance.mjs) | 决斗场平衡：23 种职业 / 转职两两 AI 对打（难度 3，公正决斗规则），无渲染快进（直接调 step），统计每个职业的回合胜率 |

### 领主、团本与区域（23）

| 脚本 | 作用 |
|---|---|
| [`test/behemoth.mjs`](../test/behemoth.mjs) | 天帷巨兽测试：数据完整性 + 每种新怪物都能生成 / 会出手 / 能被打死；每个领主的每一招都强制放一遍（看有没有报错、有没有地面预警） |
| [`test/behemoth_route.mjs`](../test/behemoth_route.mjs) | 天帷巨兽整条路线：西海岸的船（Lv.24 限制）→ 神殿之路 →（Lv.27）脊背 → 走到每个地下城门口弹出选择窗口 → 点“进入地下城” |
| [`test/boss.mjs`](../test/boss.mjs) | 通用领主测试（docs/BOSS_PLAN.md §4.2 P0-C）：进图后直接传到领主房，逐阶段 / 逐招 / 逐机制验一遍，机器人打一遍，组队对照一遍 |
| [`test/boss_prims.mjs`](../test/boss_prims.mjs) | 领主差异化 P0 原语的实验室测试（docs/BOSS_SPEC.md）：node test/boss_prims.mjs [skills,mechs,traits,engine,dungeon] |
| [`test/ozma_core.mjs`](../test/ozma_core.mjs) | 奥兹玛团本核心规则单测（不开浏览器）：src/game/ozma_core.js 的 12 人队伍、阶段计时与事件 |
| [`test/ozma_maps.mjs`](../test/ozma_maps.mjs) | 奥兹玛团本地图单测（不开浏览器）：P1 三域各 5 张图的进图 / 小怪波次 / Boss 攻击与机制阶段 / 通关，及 P2 三个终局 Boss 的阶段清单 |
| [`test/ozma_runtime.mjs`](../test/ozma_runtime.mjs) | 奥兹玛区域接入测试：区域 spec 经 defineRegion 展开、运行时桥接（OZMA_RUNTIME）与规则会话创建 |
| [`test/raid_auction.mjs`](../test/raid_auction.mjs) | 团本拍卖行规则单测（不开浏览器）：src/game/raid_core.js 的竞价、底价与离线队员处理 |
| [`test/raid_bosses.mjs`](../test/raid_bosses.mjs) | 希洛克团本领主的官方机制（P3，docs/RAID_SIROCO.md §11）：每个挂了 raidScript 的领主在实验室里逐项过一遍。 |
| [`test/raid_core_rules.mjs`](../test/raid_core_rules.mjs) | 团本核心规则单测（不开浏览器）：队长权限、拾取方式、掉落分配 |
| [`test/raid_layout.mjs`](../test/raid_layout.mjs) | 团本固定房间结构单测（不开浏览器）：genFixedLayout 的连通 / 准备房 / 随机领主房，希洛克团本每张图的官方房间数 |
| [`test/raid_mech_core.mjs`](../test/raid_mech_core.mjs) | 团本领主机制核心（src/game/raid_mech.js）的纯逻辑测试：不开浏览器，固定种子。 |
| [`test/raid_mech_lab.mjs`](../test/raid_mech_lab.mjs) | 团本领主机制运行时（game/raid_mech_rt.js）的实验室测试：样品怪挂 raidScript，逐个谜题在真实场景里解开 / 不解开。 |
| [`test/raid_rewards.mjs`](../test/raid_rewards.mjs) | 团本拾取规则单测（不开浏览器）：队长分配 / 随机分配 / 竞拍三种拾取方式的权限与结算 |
| [`test/raid_siroco_rules.mjs`](../test/raid_siroco_rules.mjs) | 无形之希洛克团本的官方规则（纯规则核心，不开浏览器、不连服务端）：破坏之门共享时限、知性之境跨图惩罚（噩梦之夜叠层 / 幻影之界 / 归还之昼）、 |
| [`test/raid_ui.mjs`](../test/raid_ui.mjs) | 团本界面 + 客户端流程（RA2）：1 个客户端，单人引导从头打到尾（本地服务端 DNF_RAID_FAST=1 + 页面 ?raidfast：节点直达领主、领主血量 ×0.05） |
| [`test/region.mjs`](../test/region.mjs) | 区域流水线的通用测试：node test/region.mjs <区域 id> [部分,...] |
| [`test/region_monsters.mjs`](../test/region_monsters.mjs) | 地下城区域的公共测试（天空之城 test/sky.mjs、天帷巨兽 test/behemoth.mjs 共用）： |
| [`test/skasa_s1.mjs`](../test/skasa_s1.mjs) | S1 机制样板：斯卡萨之巢（docs/BOSS_PLAN.md §4.3）。node test/skasa_s1.mjs [sheet,run] |
| [`test/sky.mjs`](../test/sky.mjs) | 天空之城测试：数据完整性 + 每种新怪物都能生成 / 会出手 / 能被打死；每个领主的每一招都强制放一遍（看有没有报错、有没有地面预警） |
| [`test/sky_route.mjs`](../test/sky_route.mjs) | 天空之城整条路线：西海岸云梯（Lv.14 限制）→ 天空之城区域地图 → 走到每个地下城门口弹出选择窗口 → 点“进入地下城” |
| [`test/skyguide.mjs`](../test/skyguide.mjs) | 时装外观（混搭按件数最多的一套）+ 天空套收集引导（部位状态 / 一键穿整套 / 合成器提示） |
| [`test/world.mjs`](../test/world.mjs) | 世界测试：内容校验 → 每个场景截图（素材齐全、不黑屏、有路人）→ 走遍所有出口并走回来 → 锁住的路 / 等级限制 → 所有 NPC 可对话 |

### 装备、商店、经济与任务（29）

| 脚本 | 作用 |
|---|---|
| [`test/ancient.mjs`](../test/ancient.mjs) | 远古地下城的机制测试（content/regions/ancient_rooms.js）：每个房间的机关都要能触发、也要能解开 |
| [`test/bag.mjs`](../test/bag.mjs) | 背包不限格子 + 时装页一键出售（按类别、同种留 1 件、天空套默认保留）+ 时装随时可以单件出售 |
| [`test/box100.mjs`](../test/box100.mjs) | 百连开箱：结果合并同名 + 数量、按品级排序、汇总一行；剩 ≥100 个时有“百连”按钮；背包数量对得上 |
| [`test/bulk.mjs`](../test/bulk.mjs) | 一键出售 / 一键分解：按品级勾选、保护选项、单独取消、执行结果 |
| [`test/cdr60.mjs`](../test/cdr60.mjs) | 纯冷却流（content/items/cdr60.js，docs/GEAR.md §11）：传说「时之沙漏」5 件套 + 神器「流沙」 |
| [`test/compare.mjs`](../test/compare.mjs) | 装备好坏对比：背包格子角标 ▲▼=× 与 tooltip 总结；模拟穿戴不能改动玩家真实属性 |
| [`test/contract.mjs`](../test/contract.mjs) | Conqueror's Contract：项目自定义的 PvE 装备等级便利（账号范围、+10、竞技场排除、到期卸下）。 |
| [`test/contract_rules.mjs`](../test/contract_rules.mjs) | 契约 / VIP 规则单测（不开浏览器）：在 Node VM 里跑 src/game/save.js，验证账号级契约、到期、等级上限与过级装备失效 |
| [`test/econ.mjs`](../test/econ.mjs) | 经济模拟：按正常节奏从 Lv1 玩到 Lv20，统计金币收入（怪物金币 / 翻牌 / 卖装备）与支出（药剂 / 修理 / 买装备 / 强化），验证价格是否平衡 |
| [`test/enh_nocap.mjs`](../test/enh_nocap.mjs) | 强化 / 增幅不设上限：+16 以后还能继续冲，成功率递减（最低 1%），加成继续变大；界面打开 +20 的装备不报错 |
| [`test/epicfx.mjs`](../test/epicfx.mjs) | 史诗掉落演出：落地金色闪屏 + 光柱爆闪 + 星芒 + 专属音效（带混响）；设置 → 声音 → 史诗掉落音效（本地自定义文件） |
| [`test/gear.mjs`](../test/gear.mjs) | 装备深化测试：新史诗 / 套装、绑定与交易、增幅（净化 / 成功 / 失败 / 归零 / 破碎 / 保护券）、锻造、附魔、装备图鉴、装备评分、 |
| [`test/gear60.mjs`](../test/gear60.mjs) | 装备 2.0（满级 60，docs/GEAR_PLAN_60.md）：node build.mjs && node test/gear60.mjs [core\|migrate\|content\|power\|all] [--only weapon\|armor\|acc] |
| [`test/gear_sim.mjs`](../test/gear_sim.mjs) | 装备深化的强度 / 经济模拟：同一套刷图节奏跑两遍——「旧版」（只有原来的史诗、强化）和「新版」（新史诗、深渊派对、增幅、锻造、附魔、图鉴）， |
| [`test/inspect.mjs`](../test/inspect.mjs) | 查看其他玩家：alice 穿 +12 史诗（套装 / 增幅 / 锻造 / 附魔）+ 称号 + 时装 / 武器装扮 / 光环 / 宠物 / 宠物装备，建公会（Lv5 有公会技能） |
| [`test/items.mjs`](../test/items.mjs) | 装备与经济测试：商店多选 / Shift 数量购买、出售与回购、穿戴与属性、强化成功 / 失败 / 破碎 / 保护券、分解、仓库与账号金库、耐久与修理、刷新后数据仍在 |
| [`test/levelcap.mjs`](../test/levelcap.mjs) | 满级 30 → 60（2026-09-28）：经验曲线 / 属性 / 技能上限 / 31~60 装备与商店 / 希洛克 Lv60 / 界面文字 / 决斗固定等级 / 怪物等级公式 |
| [`test/maxlv.mjs`](../test/maxlv.mjs) | 一键满级券：Lv.30 用了 → Lv.60、SP 按每级 28+n 累加、只提示一次、券扣掉；满级再用会被拒绝 |
| [`test/maxlv_acct.mjs`](../test/maxlv_acct.mjs) | 一键满级券账号共享：老存档背包里的券收进账号；任何角色都能在物品栏 / 选角界面用；邮件领取直接进账号 |
| [`test/qbalance.mjs`](../test/qbalance.mjs) | 任务经验 / 金币汇总（不开浏览器）：按任务等级分段，统计每段任务经验合计是“当级升级所需经验”的多少倍 |
| [`test/quests.mjs`](../test/quests.mjs) | 任务与转职测试： |
| [`test/quests60.mjs`](../test/quests60.mjs) | 31~60 区域的每日 / 支线 / 制霸链 / 里程碑（content/quests/regions.js） |
| [`test/quickquest.mjs`](../test/quickquest.mjs) | 低等级任务直接完成（单个 / 一键批量）+ 对话里按 Esc 跳到最后一页 |
| [`test/repair.mjs`](../test/repair.mjs) | 一键修理：物品栏按钮显示费用并修好全部装备；设置“进图自动修理”打开时进地下城自动修，关掉就不修 |
| [`test/shop.mjs`](../test/shop.mjs) | 商城与礼包测试：购买 / 限购 / 自选属性、天空套合成（固定随机种子验证概率）、开箱与十连、魔盒保底与碎片、多买多送、不放回抽奖、 |
| [`test/shop_econ.mjs`](../test/shop_econ.mjs) | 商城经济模拟：按 CASH_EARN（真实数据）算不同玩家每天 / 每周的点券产出，检查“认真玩约 1 周买一套节日时装、天空套要多次合成”， |
| [`test/shop_synth.mjs`](../test/shop_synth.mjs) | 装扮合成：自动放入（优先目标天空套还缺的部位）+ 一键合成（用完合成器 / 没有能配对的为止，已有天空的部位跳过） |
| [`test/vanity.mjs`](../test/vanity.mjs) | 面子系统测试：node test/vanity.mjs [shots]（先 node build.mjs） |
| [`test/weapons.mjs`](../test/weapons.mjs) | 武器外观测试：node test/weapons.mjs（先 node build.mjs） |

### 技能、战斗与动作手感（17）

| 脚本 | 作用 |
|---|---|
| [`test/animfeel.mjs`](../test/animfeel.mjs) | 动作手感体检（docs/ANIMATION.md）：停掉 rAF，逐个 60Hz 逻辑步驱动固定的输入序列（走 / 起步 / 跑 / 停 / 转身 / 跳 / 普攻 1~3 / 跑攻）， |
| [`test/animfeel_compare.py`](../test/animfeel_compare.py) | 动作手感体检的改前 / 改后对比图（docs/ANIMATION.md）：test/animfeel.mjs 先各跑一次（输出名 B-<名> / A-<名>）， |
| [`test/awkcancel.mjs`](../test/awkcancel.mjs) | 觉醒取消（官方现版：普攻和大部分技能施放中途都能直接切入一 / 二 / 三觉）：逐帧推进（暂停循环、确定性） |
| [`test/bench.mjs`](../test/bench.mjs) | 性能基准：在真实 GPU（Metal）、真实分辨率下测最重的几个场景，决定渲染方案用。 |
| [`test/combat.mjs`](../test/combat.mjs) | 战斗机制测试：暂停游戏循环、手动逐帧推进，逐条验证伤害公式 / 属性 / Miss / 破招 / 背击 / 浮空衰减与重力 / 倒地追击与强制起身 / |
| [`test/hurtlog.mjs`](../test/hurtlog.mjs) | 难度核查：机器人通关时记录玩家每一次被击——是谁、哪一招、有没有地面预警、离上一次被击多久（连招），汇总出“最常打中人”的招式 |
| [`test/juggle.mjs`](../test/juggle.mjs) | 浮空（juggle）定量测试：无渲染快进，直接对目标调 applyHit，量滞空时间 / 高度 / 追加浮空 / 弹地 / 重怪 / 刷图一级二级保护 / 倒地追击 / 扣地 / 决斗浮空保护 |
| [`test/juggle_core.mjs`](../test/juggle_core.mjs) | 刷图浮空保护核心（src/engine/juggle_core.js）的纯逻辑单元测试：node:vm 加载，不开浏览器，毫秒级跑完。用法：node test/juggle_core.mjs |
| [`test/motion.mjs`](../test/motion.mjs) | 动作连拍：测试房间里依次做 走 / 跑 / 普攻连段 / 技能取消 / 浮空追击 / 被打（轻、重、浮空、倒地）/ 受身 / 被抓 / 后跳 / 闪避， |
| [`test/skill_autolearn.mjs`](../test/skill_autolearn.mjs) | 一键加点 / 自动学前置 / 升级 SP 够把每个职业当前能学的技能加满（老角色补差额，只补一次；新角色不重复补） |
| [`test/skill_cancel.mjs`](../test/skill_cancel.mjs) | 通用技能后摇取消（game/skill_cancel.js，docs/SKILLS_OFFICIAL_common.md §5.3）：逐帧推进、不渲染 |
| [`test/skill_layout.mjs`](../test/skill_layout.mjs) | 技能页签布局回归：转职技能较多时，每行不能被网格压扁，觉醒技能必须能滚动到并选中。 |
| [`test/skill_sa.mjs`](../test/skill_sa.mjs) | 技能霸体：地下城里玩家放技能不会被怪物打断（普攻照常会被打断）；决斗场不受影响 |
| [`test/skillaudit.mjs`](../test/skillaudit.mjs) | 技能机制体检（skill audit）：逐帧推进（暂停游戏循环、确定性），对着木桩逐个施放某职业 / 转职的全部主动技能，量出“手感数据”， |
| [`test/skillseq.mjs`](../test/skillseq.mjs) | 技能行为连拍（鬼剑士）：一次施放拍不到的流程——再按 / 方向键 / 吸血成形 / 三觉代替收尾 / 追加输入——按脚本逐帧推进并截图，拼成一张总览图。 |
| [`test/skillshots.mjs`](../test/skillshots.mjs) | 技能连拍体检：测试房间里对着木桩（冻结的哥布林）逐个施放某职业 / 转职的全部主动技能， |
| [`test/soak.mjs`](../test/soak.mjs) | 长时间测试：机器人连续多次通关同一地下城（结算后点“再次挑战”），每轮强制 GC 后记录堆内存、实体/特效数量、帧率 |

### 职业专项（40）

| 脚本 | 作用 |
|---|---|
| [`test/avenger.mjs`](../test/avenger.mjs) | 复仇者（圣职者转职 avenger，P-avenger）机制测试 + 画面截图 + 组队可见性。node test/avenger.mjs [mech,shots,coop]（默认 mech,shots，约 1 分钟） |
| [`test/brawler.mjs`](../test/brawler.mjs) | 街霸（男格斗家转职 brawler，B6）机制测试：node test/brawler.mjs [load,throws,status,grab,chain,awaken,shots]（默认除 shots 以外全部，约 1 分钟） |
| [`test/classes.mjs`](../test/classes.mjs) | 职业测试：测试房间里依次使用普攻连段 / 跑攻 / 跳攻 / 技能栏上的技能 / 指令，截图并收集报错 |
| [`test/crusader.mjs`](../test/crusader.mjs) | 圣骑士（男圣职者转职 crusader）机制测试。node test/crusader.mjs [mech,coop]（默认 mech；coop 要起本地服务端：worktree 里先软链 server/node_modules） |
| [`test/enchantress.mjs`](../test/enchantress.mjs) | 小魔女（魔法师转职 enchantress）：暂停游戏循环、手动逐帧推进验证。node test/enchantress.mjs |
| [`test/exorcist.mjs`](../test/exorcist.mjs) | 驱魔师（圣职者转职 exorcist，P-exorcist）机制测试 + 画面截图 + 组队可见性。node test/exorcist.mjs [mech,shots,coop]（默认 mech,shots，约 1 分钟） |
| [`test/fighter.mjs`](../test/fighter.mjs) | 格斗家（男）骨架（B0）+ 基础职业（B3）测试（docs/CLASS_PLAN_FIGHTER.md §4.1）。node test/fighter.mjs [save,ids,feel,switch,smoke,base]（默认全部，约 1.5 分钟） |
| [`test/fighter_brawler.mjs`](../test/fighter_brawler.mjs) | 格斗家转职测试：街霸（brawler，B6，docs/CLASS_PLAN_FIGHTER.md §4）。node test/fighter_brawler.mjs（约 10 秒，quick.sh g2 / all.sh） |
| [`test/fighter_fists_debug.mjs`](../test/fighter_fists_debug.mjs) | 调拳头区域（avatar.js avFists）用：node test/fighter_fists_debug.mjs [帧,...] → test/shots/fighter_looks/fists_debug.jpg |
| [`test/fighter_gloves.mjs`](../test/fighter_gloves.mjs) | 格斗家拳上武器近景对照（B2 修“双手”：手套盖不住拳头 / 远侧手套压在脸上）：node test/fighter_gloves.mjs [输出名=gloves] [帧,...] |
| [`test/fighter_gloves_town.mjs`](../test/fighter_gloves_town.mjs) | 复现用户截图：Lv60 基础格斗家在城镇站着，拿满级角色的武器（+12）→ 游戏画面裁到人物、放大 4 倍 |
| [`test/fighter_grappler.mjs`](../test/fighter_grappler.mjs) | 格斗家转职测试：柔道家（grappler，B7）。node test/fighter_grappler.mjs（约 20 秒） |
| [`test/fighter_launch.mjs`](../test/fighter_launch.mjs) | 男格斗家上线前的整条流程（B9，docs/CLASS_PLAN_FIGHTER.md §6）：网址带 ?fighter=1（开关没打开也能测），真实存档（localStorage），不连服务器 |
| [`test/fighter_looks.mjs`](../test/fighter_looks.mjs) | 格斗家（男）外观测试（B2，docs/FIGHTER_ART_SAMPLES.md §9）：node test/fighter_looks.mjs [shots] [live]（先 node build.mjs） |
| [`test/fighter_nenmaster.mjs`](../test/fighter_nenmaster.mjs) | 格斗家转职测试：气功师（nenmaster，B4）。node test/fighter_nenmaster.mjs（约 30 秒） |
| [`test/fighter_quests.mjs`](../test/fighter_quests.mjs) | 格斗家（男）转职 / 觉醒任务线（B8，docs/CLASS_PLAN_FIGHTER.md §2.5；content/quests/fighter.js + quests/job.js 的 JOB_CHAINS.fighter）。 |
| [`test/fighter_striker.mjs`](../test/fighter_striker.mjs) | 格斗家转职测试：散打（striker，B5）。node test/fighter_striker.mjs（约 10 秒；quick.sh g2） |
| [`test/grappler.mjs`](../test/grappler.mjs) | 柔道家（男格斗家转职 grappler，B7）机制测试：暂停循环、逐帧推进（确定性）。node test/grappler.mjs [mech,boss,shots]（默认 mech,boss，约 40 秒） |
| [`test/gun_range.mjs`](../test/gun_range.mjs) | 神枪手技能判定范围体检：每个技能对着“单个”轻木桩施放多次（木桩逐个摆在不同距离 / 纵深），量出真正能打到的范围。 |
| [`test/gunner.mjs`](../test/gunner.mjs) | 神枪手（女）+ 通用操作的官方对齐测试（docs/SKILLS_OFFICIAL_common.md / SKILLS_OFFICIAL_gun.md）：暂停游戏循环、逐帧推进，逐条验证 |
| [`test/gunner_jobs.mjs`](../test/gunner_jobs.mjs) | 神枪手（女）转职的官方对齐测试（docs/SKILLS_OFFICIAL_gun.md 第 4、5 节）：暂停游戏循环、逐帧推进 |
| [`test/infighter.mjs`](../test/infighter.mjs) | 蓝拳圣使（男圣职者转职 monk / Infighter）机制测试。node test/infighter.mjs（约 40 秒） |
| [`test/infighter_contract.mjs`](../test/infighter_contract.mjs) | 气功师·念气 转职契约检查（不开浏览器）：技能 id、源码与 docs/skills/priest_infighter_final.md 三方对齐 |
| [`test/mage.mjs`](../test/mage.mjs) | 魔法师（女）基础技能行为回归（docs/skills/mage_behavior.md 基础部分）： |
| [`test/mechanic.mjs`](../test/mechanic.mjs) | 机械师（女）测试（docs/SKILLS_OFFICIAL_gun.md 第 6 节）：暂停游戏循环、逐帧推进，逐条验证 |
| [`test/nenmaster.mjs`](../test/nenmaster.mjs) | 气功师（格斗家 nenmaster，B4）机制测试：逐帧 step（确定性），约 30 秒。node test/nenmaster.mjs [shots] |
| [`test/paramedic.mjs`](../test/paramedic.mjs) | 协战师（神枪手第 5 转职，辅助；docs/SKILLS_OFFICIAL_gun.md 第 8 节）：暂停游戏循环、逐帧推进，逐条验证 |
| [`test/priest.mjs`](../test/priest.mjs) | 圣职者（男）骨架（B0）+ 基础职业（docs/CLASS_PLAN_PRIEST.md）测试。node test/priest.mjs [switch,ids,party,base,smoke]（默认全部，约 1 分钟） |
| [`test/priest_avenger.mjs`](../test/priest_avenger.mjs) | 圣职者转职测试：复仇者（avenger，P-avenger）。node test/priest_avenger.mjs（约 25 秒） |
| [`test/priest_crusader.mjs`](../test/priest_crusader.mjs) | 圣职者转职测试：圣骑士（crusader，P-crusader）。node test/priest_crusader.mjs（约 20 秒） |
| [`test/priest_exorcist.mjs`](../test/priest_exorcist.mjs) | 圣职者转职测试：驱魔师（exorcist，P-exorcist）。node test/priest_exorcist.mjs（约 20 秒） |
| [`test/priest_infighter.mjs`](../test/priest_infighter.mjs) | 圣职者转职测试：蓝拳圣使（转职 id monk，技能前缀 pi_ = Infighter，P-infighter）。node test/priest_infighter.mjs（约 15 秒） |
| [`test/spitfire.mjs`](../test/spitfire.mjs) | 弹药专家（女）测试（docs/SKILLS_OFFICIAL_gun.md 第 7 节）：暂停游戏循环、逐帧推进，逐条验证 |
| [`test/spitfire_shots.mjs`](../test/spitfire_shots.mjs) | 弹药专家技能截图（目测特效 / 动作用，不算回归测试）：node test/spitfire_shots.mjs [技能id,...] → test/shots/spitfire/*.png |
| [`test/striker.mjs`](../test/striker.mjs) | 散打（男格斗家转职 striker，B5）机制测试 + 画面截图。node test/striker.mjs [mech,shots]（默认全部，约 40 秒） |
| [`test/summon.mjs`](../test/summon.mjs) | 召唤物框架 + 新异常状态 + 受击前钩子（魔法师对齐组）：暂停游戏循环、手动逐帧推进验证。node test/summon.mjs |
| [`test/summoner.mjs`](../test/summoner.mjs) | 召唤师（魔法师对齐组第 3 阶段）：逐个施放召唤技能，检查召唤兽出场、用正式美术、会出手、交感 / 全体指令 / 献祭 / 印记能用、换房间跟随、决斗场 AI 能放。 |
| [`test/sword.mjs`](../test/sword.mjs) | 鬼剑士（男）官方对齐测试（docs/SKILLS_OFFICIAL_sword.md）：暂停游戏循环、逐帧推进，逐条验证 |
| [`test/witch.mjs`](../test/witch.mjs) | 魔道学者（mage_witch.js）：暂停游戏循环、手动逐帧推进验证。node test/witch.mjs（阶段交付时再跑一次 node test/classes.mjs mage:witch：按键放技能栏上的技能） |
| [`test/witch_shots.mjs`](../test/witch_shots.mjs) | 魔道学者技能截图（人工检查美术 / 座位 / 特效用）：node test/witch_shots.mjs [技能id,...] [--set 套装] |

### 外观与美术（9）

| 脚本 | 作用 |
|---|---|
| [`test/art.mjs`](../test/art.mjs) | 美术实验室截图：node test/art.mjs <输出png> "<查询参数>" |
| [`test/avatar.mjs`](../test/avatar.mjs) | 外观与换装测试：node test/avatar.mjs [shots]（先 node build.mjs） |
| [`test/avatar_mix.mjs`](../test/avatar_mix.mjs) | 混搭时装样例（游戏里真的穿上物品，用玩家自己的模型画）：node test/avatar_mix.mjs [职业] [输出png] '[部位=物品key,...]' |
| [`test/avatar_onion.mjs`](../test/avatar_onion.mjs) | 洋葱皮对照（人工验收用）：原装帧（青色半透明）叠在时装帧（原色）下面，都按脚底锚点放在同一点。 |
| [`test/avatar_sample.mjs`](../test/avatar_sample.mjs) | 时装样例图（人工验收 / 发给商城组）：三职业 × 4 个动作（待机、走路、普攻两帧），穿整套 + 配件 |
| [`test/avatar_zoom.mjs`](../test/avatar_zoom.mjs) | 外观放大图（人工验收用）：node test/avatar_zoom.mjs <帧,帧,...\|ALL\|ALL:前缀> '<looks JSON>' <输出png> [职业] [倍数] [每行几格] |
| [`test/jobvisuals.mjs`](../test/jobvisuals.mjs) | 转职外观测试：node test/jobvisuals.mjs [shots] [glow]（先 node build.mjs） |
| [`test/music.mjs`](../test/music.mjs) | 音乐测试：逐首播放，采样 RMS / 峰值，检查无报错、不静音、不削波 |
| [`test/music_bosses.mjs`](../test/music_bosses.mjs) | 领主曲测试：每个区域的领主房选到自己的曲目（bossTrack），12 首领主曲逐首播放——不静音、不削波、无报错 |

### 界面、移动端与整体流程（14）

| 脚本 | 作用 |
|---|---|
| [`test/bestiary.mjs`](../test/bestiary.mjs) | 图鉴测试：逐个生成怪物，让玩家站着挨打若干秒，统计每下伤害占“同等级玩家血量”的比例，截图，收集报错。 |
| [`test/botrun.mjs`](../test/botrun.mjs) | 机器人通关测试：?dungeon=ID&bot&lv=N，统计用时 / 评价 / 死亡次数，收集报错，定时截图 |
| [`test/flow.mjs`](../test/flow.mjs) | 全流程测试：标题 → 角色选择 → 创建角色 → 艾尔文防线 → NPC 窗口 → 背包/技能/角色/系统 → 走出城到格兰之森 → 洛兰门口 → 机器人通关 → 结算翻牌 → 回到门口 → 刷新继续存档 |
| [`test/guide.mjs`](../test/guide.mjs) | 任务线路指引 + 自动前往：新角色在赛丽亚的房间 → 指引到赛丽亚 → 自动前往并对话 → 接主线 → 指引切到下一个目标 → 自动跨场景前往 |
| [`test/kbplay.mjs`](../test/kbplay.mjs) | 真实按键试玩的公共部分：像玩家一样用键盘 / 鼠标操作（只读游戏状态来“看屏幕”，不改状态） |
| [`test/mobile.mjs`](../test/mobile.mjs) | 触屏测试：iPhone 13 横屏模拟（hasTouch / isMobile），用 CDP Input.dispatchTouchEvent 发真实触摸（多指、按住、滑动），不用 ?touch |
| [`test/mobile_buff.mjs`](../test/mobile_buff.mjs) | 手机状态键：没放进技能栏的 Buff（方向 + 空格那类）/ 受击技能出现在最右边一列，点一下就放 |
| [`test/mobile_fighter.mjs`](../test/mobile_fighter.mjs) | 手机操作 · 男格斗家（B9）：iPhone 13 横屏模拟 + CDP 真实触摸（不用 ?touch），网址带 ?fighter=1 |
| [`test/perf.mjs`](../test/perf.mjs) | 帧率测试：测试房间里持续战斗（普攻 + 轮流放技能），统计逻辑 step / 渲染的耗时与帧率。node test/perf.mjs sword,gun,mage [秒] |
| [`test/play.mjs`](../test/play.mjs) | 自动操作冒烟测试：载入测试房间，脚本化按键（移动、普攻三连、跑攻、跳攻、技能、指令），截图 + 收集报错 |
| [`test/playthrough.mjs`](../test/playthrough.mjs) | 真实试玩：像玩家一样用键盘 / 鼠标从头玩（kbplay.mjs），每一步截图，记录发现的问题 |
| [`test/polish.mjs`](../test/polish.mjs) | 收尾打磨的回归：提示横幅排队 / 任务与获得类消息只进系统消息、1280 宽 I/M/K 并排、路人名牌不重叠、NPC 眨眼、隐藏门、决斗后回城 |
| [`test/ui.mjs`](../test/ui.mjs) | 界面与操作测试：角色创建 / 选择 / 删除 / 切换（各自存档）、快捷键 → 窗口、改键生效并持久化、技能拖到技能栏、 |
| [`test/walk.mjs`](../test/walk.mjs) | 以玩家视角把联机和新玩法走一遍（本机临时服务端，不连线上；1 个浏览器里 2 个玩家）： |

## 服务端测试（`server/test/`）

直接起本机临时库跑真实服务端（`sh test/all.sh` 会先装好 `server/` 依赖）。

### 服务端（5）

| 脚本 | 作用 |
|---|---|
| [`server/test/admin.mjs`](../server/test/admin.mjs) | 后台管理接口自测（不需要浏览器）：权限（每个新接口：没登录 401、普通玩家 403）、账号列表 / 搜索 / 排序 / 详情、封禁 / 解封、踢下线、重设密码、 |
| [`server/test/api.mjs`](../server/test/api.mjs) | 服务端接口自测（不需要浏览器）：临时数据库起服务 → 注册 / 登录 / 云存档往返与冲突 / 好友 / WS 聊天 / 同屏 / 队伍 / 房间转发 / 断线宽限 / 限流 |
| [`server/test/arena.mjs`](../server/test/arena.mjs) | 决斗场排位（server/modules/arena.js）接口自测，不需要浏览器：匹配 / AI 补位 / 积分 / AI 减半 / 不重复匹配 / 退出队列 / 排队中断线 / 逃跑判负 / 结果对不上作废 / 奖励 / 排行榜 |
| [`server/test/raid.mjs`](../server/test/raid.mjs) | 团本（server/modules/raid.js + src/game/raid_core.js）自测，不需要浏览器。时间用 cfg.raidShift 平移（不真等），计时靠手动 tick |
| [`server/test/restore.mjs`](../server/test/restore.mjs) | 服务端重启后恢复队伍和房间（不需要浏览器）：组队 + 地下城房间 / 决斗房间 → 重启服务端（同端口同库）→ 队长登记、队员认领 → 房间恢复、转发照常； |

## 美术流水线（`art/tools/`）

生图（gpt-image）、去底、切帧、拼图集、质检。总流程见 `docs/ART_PIPELINE.md`；原图写到 `art/src/`（不进 git），成品在 `art/final/`。多数脚本都能 `python3 art/tools/<名字>.py -h` 看用法。

### 换装与外观（`avatar_*`）（19）

| 脚本 | 作用 |
|---|---|
| [`art/tools/avatar_acc.py`](../art/tools/avatar_acc.py) | 外观与换装：头部配件表（帽子、发饰、眼镜，一行 3 个）→ art/final/avatar/<套装>_<部位>.webp |
| [`art/tools/avatar_align.py`](../art/tools/avatar_align.py) | 外观与换装：时装帧对齐原装同名帧（大小 + 位置）。 |
| [`art/tools/avatar_beforeafter.py`](../art/tools/avatar_beforeafter.py) | 外观与换装：某个提交（改动前）和现在的时装帧并排对比，按脚底锚点对齐画成一条（人工看闪烁 / 大小 / 位置）。 |
| [`art/tools/avatar_check.py`](../art/tools/avatar_check.py) | 外观与换装：时装帧集和原装帧逐帧对照（切帧后自查）。 |
| [`art/tools/avatar_compare.py`](../art/tools/avatar_compare.py) | 外观与换装：原表 / 改图后的表并排缩小，方便逐张检查武器有没有丢、姿势有没有变。 |
| [`art/tools/avatar_crossscale.py`](../art/tools/avatar_crossscale.py) | 外观与换装：同一帧在各套时装之间比大小（各套都摘了帽子 / 披风，比和原装比可靠）。 |
| [`art/tools/avatar_cuts.py`](../art/tools/avatar_cuts.py) | 外观与换装：混搭时装用的分割线（每帧），写进原装 spr.json 的 F.cut。 |
| [`art/tools/avatar_flicker.py`](../art/tools/avatar_flicker.py) | 外观与换装：同一片段里衣服颜色 / 花纹的帧间差异（闪烁）。 |
| [`art/tools/avatar_frames.py`](../art/tools/avatar_frames.py) | 外观与换装：占位武器动作表 → 精灵帧 + 每帧武器轨迹（写进 spr.json 的 wpn / wpn2） |
| [`art/tools/avatar_gen.py`](../art/tools/avatar_gen.py) | 外观与换装：生图（原图写到主仓库 art/src/avatar/，该目录不进 git）。 |
| [`art/tools/avatar_hands.py`](../art/tools/avatar_hands.py) | 外观与换装：每帧的副手（不拿武器的那只手，鬼剑士的鬼手）锚点，写进原装 spr.json 的 F.oh = [x, y]（帧像素）。 |
| [`art/tools/avatar_hatcheck.py`](../art/tools/avatar_hatcheck.py) | 原装帽子检查：神枪手 / 魔法师的原装帧都应该戴着报童帽 / 巫师帽（运行时 AVATAR_HAT_CLS：默认造型自带帽子， |
| [`art/tools/avatar_head.py`](../art/tools/avatar_head.py) | 外观与换装：每帧的头部锚点（帽子 / 发饰 / 眼镜按它叠加）。 |
| [`art/tools/avatar_headcheck.py`](../art/tools/avatar_headcheck.py) | 外观与换装：时装帧的头部锚点和原装同帧对照（姿势一样，按脚底锚点平移后头应该在差不多的位置）。 |
| [`art/tools/avatar_review.py`](../art/tools/avatar_review.py) | 外观与换装：时装表批量自查。每个职业一张总览（左：占位表 / 原表，右：时装表），逐张看武器有没有丢、姿势和衣服对不对。 |
| [`art/tools/avatar_sheetflicker.py`](../art/tools/avatar_sheetflicker.py) | 外观与换装：动作表（3×3）里衣服的帧间差异打分（不用切帧，直接比较原表 / 返修表）。 |
| [`art/tools/avatar_sizecheck.py`](../art/tools/avatar_sizecheck.py) | 外观与换装：时装帧和原装同名帧比较大小 / 姿势，列出偏差大的帧。 |
| [`art/tools/avatar_unify_pick.py`](../art/tools/avatar_unify_pick.py) | 外观与换装：比较时装表和“统一细节”重画的表，挑更稳定、姿势没变的那张。 |
| [`art/tools/avatar_weapons.py`](../art/tools/avatar_weapons.py) | 外观与换装：武器图表 → art/final/weapon/<key>.webp + src/content/avatar/weapon_art.js（握点 / 尖端数据） |

### 武器图与武器设计（6）

| 脚本 | 作用 |
|---|---|
| [`art/tools/fighter_weapons_art.py`](../art/tools/fighter_weapons_art.py) | 格斗家（男）拳上武器（B2）：5 类 × 普通 / 稀有 / 神器 / 传说 + 6 款武器装扮，一张图画一整组，切成一把一张交给 avatar_weapons.py |
| [`art/tools/wdesign_gun.py`](../art/tools/wdesign_gun.py) | 装备 2.0 · B1b 神枪手武器的设计文字（docs/GEAR_PLAN_60.md §6 / §7）：avatar_gen.py 读进 BOLD_EPICS，weapon_gen.py 一把一张出图 |
| [`art/tools/wdesign_mage.py`](../art/tools/wdesign_mage.py) | 装备 2.0 · B1c 魔法师武器的设计文字（docs/GEAR_PLAN_60.md §7）：avatar_gen.py 读 DESIGNS 追加进 BOLD_EPICS，weapon_gen.py 按它出 v2 单张图。 |
| [`art/tools/wdesign_sword.py`](../art/tools/wdesign_sword.py) | 装备 2.0 · B1a 鬼剑士武器设计（docs/GEAR_PLAN_60.md §7）：avatar_gen.py 把 DESIGNS 追加进 BOLD_EPICS，weapon_gen.py 按它出 v2 单张图。 |
| [`art/tools/weapon_gen.py`](../art/tools/weapon_gen.py) | 武器 v2 生图：一把武器一张图（1536x1024 白底，横放、握柄在左、尖端 / 枪口 / 杖头在右）→ 主仓库 art/src/avatar/weapons2/<key>.png |
| [`art/tools/weapon_review.py`](../art/tools/weapon_review.py) | 武器审图总览（一张图发主线程）：每把武器 = 武器图原大（art/final/weapon，3 倍存）+ 城镇 1 倍拿在手里的 之前 / 之后（站立 + 攻击） |

### 装备、附魔与商城图标（14）

| 脚本 | 作用 |
|---|---|
| [`art/tools/asset_shrink.py`](../art/tools/asset_shrink.py) | 素材瘦身（docs/ASSET_AUDIT.md §6）：只重新压缩透明通道，彩色部分一个字节都不改，尺寸 / 锚点不变。 |
| [`art/tools/cash_art.py`](../art/tools/cash_art.py) | 商城美术流水线（商城组）：宠物帧、光环、商城物品图标。 |
| [`art/tools/ench_art.py`](../art/tools/ench_art.py) | 小魔女的召唤物 / 物件美术（魔法师组起稿，小魔女组接手）：疯疯熊、僵尸人偶、林中小屋。流水线同 witch_art.py（sky_art 的参考立绘 → 动作表 → 切帧，支持自定义帧名）。 |
| [`art/tools/ench_kit_art.py`](../art/tools/ench_kit_art.py) | 小魔女（enchantress）的人物动作表 / 特效 / 图标 / 插图（小魔女组；召唤物与物件见 ench_art.py）。 |
| [`art/tools/gear_icons.py`](../art/tools/gear_icons.py) | 装备深化的物品图标：生成 3×2 的图标表（gpt-image，参考现有史诗图标的画风）→ 按格子切成单个图标 → art/final/icon/item_<key>.webp（128×128） |
| [`art/tools/gear_icons_acc60.py`](../art/tools/gear_icons_acc60.py) | 装备 2.0 · B3 首饰 / 辅助装备 / 魔法石的图标表（gear_icons.py 自动合并；用法：python3 art/tools/gear_icons.py gen\|cut <表名>） |
| [`art/tools/gear_icons_armor60.py`](../art/tools/gear_icons_armor60.py) | 装备 2.0 · B2 防具的图标表（gear_icons.py 自动合并这里的 SHEETS；用法：python3 art/tools/gear_icons.py gen\|cut <表名...>） |
| [`art/tools/gear_icons_cdr60.py`](../art/tools/gear_icons_cdr60.py) | 装备 2.0 · 纯冷却流（content/items/cdr60.js）的图标表（gear_icons.py 自动合并；用法：python3 art/tools/gear_icons.py gen\|cut <表名...>） |
| [`art/tools/gear_icons_pink60_fighter.py`](../art/tools/gear_icons_pink60_fighter.py) | 装备 2.0 · 格斗家武器（B8 二期）：72 件具名史诗 + 17 件领主神器 / 粉装的图标（只做图标；拿在手里 = <类型>_r4 / _r3 + 物品上的 pal 配色）。 |
| [`art/tools/gear_icons_pink60_gun.py`](../art/tools/gear_icons_pink60_gun.py) | 装备 2.0 · B1b 神枪手的领主神器 / 60 版 Lv55 粉装图标（gear_icons.py 合并进 SHEETS；gen / cut 用法见 gear_icons.py） |
| [`art/tools/gear_icons_pink60_mage.py`](../art/tools/gear_icons_pink60_mage.py) | 装备 2.0 · B1c 魔法师武器的领主神器 / Lv55 粉装图标（只做图标，拿在手里用 <类型>_r3 外观）。 |
| [`art/tools/gear_icons_pink60_sword.py`](../art/tools/gear_icons_pink60_sword.py) | 装备 2.0 · B1a 鬼剑士武器的领主神器图标（粉色品级；拿在手里用 <类型>_r3 外观，所以只做图标） |
| [`art/tools/icons.py`](../art/tools/icons.py) | 把图标表切成单个图标：去背 → 连通块 → 按行列排序 → 依次命名 → 128×128 WebP（art/final/icon/<名字>.webp）。 |
| [`art/tools/quest_icons.py`](../art/tools/quest_icons.py) | 任务道具图标：把 AI 生成的 3x3 图标表（art/src/quests/sheet{A,B,C}.png）切成 104x104 的圆角图标， |

### 区域、背景与世界（5）

| 脚本 | 作用 |
|---|---|
| [`art/tools/bgs.py`](../art/tools/bgs.py) | 场景图层：远景（1650 宽，截取 22%~92%）/ 地面（按场景缩放后截 470 高的一条）/ 交界带（去背后按宽度缩放）→ art/final/bg/*.webp |
| [`art/tools/region_art.py`](../art/tools/region_art.py) | 区域美术流水线：读区域 spec（src/content/regions/<id>.js，经 region_spec.mjs 导出成 JSON），一条命令批量出图。 |
| [`art/tools/region_spec.mjs`](../art/tools/region_spec.mjs) | 把区域 spec（src/content/regions/<id>.js，纯数据的 defineRegion({...})）导出成 JSON，给 art/tools/region_art.py 用 |
| [`art/tools/sky_art.py`](../art/tools/sky_art.py) | 天空之城美术流水线（地下城内容组）：参考立绘 → 动作表 → 切帧；三层手绘背景。 |
| [`art/tools/worldprep.py`](../art/tools/worldprep.py) | 城镇美术：建筑 b_* / 地下城门 g_* / NPC npc_* / 道具表 props_*（4×4 切成 p_*）→ 去背、裁边、缩放 → art/final/world/*.webp |

### 通用基础库（被其他脚本调用）（13）

| 脚本 | 作用 |
|---|---|
| [`art/tools/combatgen.py`](../art/tools/combatgen.py) | 战斗与动作的美术生成：新动作表（3×3，第 1 格站姿参考 + 8 帧）、技能图标表、技能特效。 |
| [`art/tools/frames.py`](../art/tools/frames.py) | 动作表 → 逐帧精灵：去背 → 连通块（小碎块并入最近的大块）→ 按行列排序 → 命名 → 统一比例（按每张表第 1 帧“站立”的高度） |
| [`art/tools/frames2.py`](../art/tools/frames2.py) | 第二版切帧：3×3 动作表 → 9 帧（第 1 格为站姿参考，只用 walk 表的那张作 idle）。 |
| [`art/tools/fxprep.py`](../art/tools/fxprep.py) | 特效素材：发光类（黑底）→ 亮度转透明度（alpha = 最亮通道，颜色反预乘），裁到内容，按用途缩放；实体类（白底）→ 抠图。输出 art/final/fx/*.webp |
| [`art/tools/gridsheet.py`](../art/tools/gridsheet.py) | 把若干部件图加 0.1 网格拼成一张，方便人工标注关节点。用法：gridsheet.py OUT.png rig:idx[:label] ... |
| [`art/tools/jobs.py`](../art/tools/jobs.py) | 批量生图：按阶段定义全部美术任务，并发调用 gpt-image 技能脚本；已存在的输出自动跳过（可断点续跑）。 |
| [`art/tools/marker_check.py`](../art/tools/marker_check.py) | 魔法师动作表的占位色自查：每格里“像占位棍的纯绿”和“像杖头标记的品红”各有多少像素（切帧工具会把它们当武器抠掉）。 |
| [`art/tools/perframe.py`](../art/tools/perframe.py) | 逐帧生成走 / 跑：每一帧单独一张图（角色立绘 + 单个小人姿势图），AI 只需照着一个姿势画，手脚更准。 |
| [`art/tools/poseguide.py`](../art/tools/poseguide.py) | 走 / 跑姿势参考图：3×3 格，第 1 格站立，其余 8 格是一个完整的步态循环。 |
| [`art/tools/prep.py`](../art/tools/prep.py) | 美术素材预处理：白底去背（带抗锯齿去白边）、部件拆分、背景图层裁切。只依赖 numpy + Pillow。 |
| [`art/tools/rig.py`](../art/tools/rig.py) | 把拆好的部件装配成骨骼角色：自动找关节点（可在 spec 里手动覆盖），推导骨骼尺寸，输出 WebP + 装配数据。 |
| [`art/tools/sheets.py`](../art/tools/sheets.py) | 逐帧动作表：以角色立绘为参考，一张图画同一角色的 8 个动作（4 列 × 2 行），保证同一张表内比例 / 画风一致。 |
| [`art/tools/sheets2.py`](../art/tools/sheets2.py) | 第二版动作表：3×3 格，第 1 格是标准站姿（统一比例用），其余 8 格是连续的动画帧。 |

### 职业、召唤物与怪物美术（38）

| 脚本 | 作用 |
|---|---|
| [`art/tools/behemoth_art.py`](../art/tools/behemoth_art.py) | 天帷巨兽美术（地下城内容组）：和 sky_art.py 同一套流水线，只是换了怪物 / 背景设定与输出目录。 |
| [`art/tools/crusader_art.py`](../art/tools/crusader_art.py) | 圣骑士（男圣职者转职 crusader，技能前缀 pc_）美术：技能图标（pc_*）、觉醒插图（cutin/crusader{,2,3}）、转职立绘（job/crusader）。 |
| [`art/tools/exorcist_avenger_art.py`](../art/tools/exorcist_avenger_art.py) | 男圣职者转职 驱魔师（exorcist，pe_）/ 复仇者（avenger，pa_）的美术：技能图标、觉醒插图（cutin/<转职>{,2,3}）、转职立绘（job/<转职>）、 |
| [`art/tools/fighter_arms_art.py`](../art/tools/fighter_arms_art.py) | 格斗家（男）拳上武器的手臂层（B2 第二版：不再把武器图贴在拳头上，而是让模型把“戴着武器的小臂和拳头”按每一帧的姿势重画） |
| [`art/tools/fighter_art.py`](../art/tools/fighter_art.py) | 格斗家（男）B1 原装人物帧（docs/CLASS_PLAN_FIGHTER.md §3、docs/FIGHTER_ART_SAMPLES.md）。 |
| [`art/tools/fighter_base_art.py`](../art/tools/fighter_base_art.py) | 格斗家（男）基础职业（B3）的美术：15 个基础技能图标（一张 4×4 表，第 16 格是职业徽记 f_emblem）。 |
| [`art/tools/fighter_brawler_art.py`](../art/tools/fighter_brawler_art.py) | 街霸（男格斗家转职 brawler，B6）的美术：技能图标（30 个，3 张表）/ 觉醒插图（一 / 二 / 三觉）/ 转职立绘。 |
| [`art/tools/fighter_brawler_cmp.py`](../art/tools/fighter_brawler_cmp.py) | 街霸图标审图：把新切的 fb_* 图标和对照图标（散打 fs_* / 现有图标）并排拼成一张（每行上面是 fb、下面是对照），给主线程一次看完。 |
| [`art/tools/fighter_fists.py`](../art/tools/fighter_fists.py) | 格斗家（男）缺的拳头锚点（B2，拳上武器 cover 用）：原装帧里只有一只拳有锚点、另一只拳其实露在外面（走路护在下巴前的后手、跑步往后甩的手、刺拳的后手…） |
| [`art/tools/fighter_grappler_art.py`](../art/tools/fighter_grappler_art.py) | 柔道家（男格斗家转职 grappler，B7）的美术：技能图标 28 个（2 张表）、觉醒插图 3 张、转职立绘 1 张，共 6~7 次生图。 |
| [`art/tools/fighter_looks_art.py`](../art/tools/fighter_looks_art.py) | 格斗家（男）时装帧（B2）：6 套时装（含天空套 2 套）× 6 张 4×4 表 → art/final/spr/fighter@<套装>/（91 帧，和原装同名） |
| [`art/tools/fighter_nen_art.py`](../art/tools/fighter_nen_art.py) | 气功师（男格斗家 nenmaster，B4）美术：29 个技能图标（3 张表）、觉醒插图 3 张（cutin/nenmaster{,2,3}）、转职立绘（job/nenmaster）。 |
| [`art/tools/fighter_shots.mjs`](../art/tools/fighter_shots.mjs) | 格斗家（男）原装帧的游戏内连拍（docs/FIGHTER_ART_SAMPLES.md）：测试房间 ?fighter=1，左边站一个鬼剑士，两人喂同一套输入（站立 / 双击跑 / 普攻 4 段 / 跳 + 空中踢），比比例和节奏。 |
| [`art/tools/infighter_art.py`](../art/tools/infighter_art.py) | 蓝拳圣使（男圣职者转职，转职 id monk，技能前缀 pi_ = Infighter）美术：技能图标（pi_*）、觉醒插图（cutin/monk{,2,3}）、转职立绘（job/monk）。 |
| [`art/tools/job_art.py`](../art/tools/job_art.py) | 转职立绘：把 AI 生成的白底原图（art/src/quests/job_<jobId>.png）去背、裁边、缩放， |
| [`art/tools/job_head_art.py`](../art/tools/job_head_art.py) | 转职头饰（每个转职一件，按头部锚点叠加，见 src/content/avatar/job_looks.js 和 docs/JOB_VISUALS.md §5） |
| [`art/tools/jobvis_art.py`](../art/tools/jobvis_art.py) | 职业外观（docs/JOB_VISUALS.md）的特效素材：只做覆盖层画不出来的东西（火焰舌、鬼火精灵等小动画条）。 |
| [`art/tools/mage_art.py`](../art/tools/mage_art.py) | 魔法师对齐组的美术：新动作表 / 图标 / 特效（沿用 combatgen.py 的流水线，只替换表的内容，不修改 combatgen.py）。 |
| [`art/tools/mech_art.py`](../art/tools/mech_art.py) | 机械师（女）美术：机器人（召唤框架的 follower）的参考图 → 动作表 → 切帧；技能图标；转职立绘 / 觉醒插图。 |
| [`art/tools/paramedic_art.py`](../art/tools/paramedic_art.py) | 协战师（神枪手第 5 转职）美术：强袭战斗服整套动作帧、技能图标、特效、转职立绘、觉醒插图。 |
| [`art/tools/priest_art.py`](../art/tools/priest_art.py) | 男圣职者（priest）原装人物帧（docs/PRIEST_ART.md）。流水线照搬格斗家的 4×4 做法（docs/FIGHTER_ART_SAMPLES.md、fighter_art.py）： |
| [`art/tools/priest_base_art.py`](../art/tools/priest_base_art.py) | 圣职者（男）基础职业（P-core）的美术：11 个基础技能图标 + 职业徽记 p_crest（一张 4×3 表）。 |
| [`art/tools/spitfire_art.py`](../art/tools/spitfire_art.py) | 弹药专家组的美术：新动作表 / 技能图标 / 道具特效 / 觉醒插图 / 转职立绘（沿用 combatgen.py 的流水线，只替换表的内容，不修改 combatgen.py）。 |
| [`art/tools/striker_art.py`](../art/tools/striker_art.py) | 散打（男格斗家转职 striker，B5）美术：技能图标（fs_*）、觉醒插图（cutin/striker{,2,3}）、转职立绘（job/striker）。 |
| [`art/tools/summon_art.py`](../art/tools/summon_art.py) | 召唤师召唤兽美术（魔法师对齐组）：和 sky_art.py 同一套流水线（参考立绘 → 动作表 → 切帧），只换设定与输出目录。 |
| [`art/tools/summon_outline.py`](../art/tools/summon_outline.py) | 给发光系召唤兽的精灵帧加一圈深色描边（亮背景上也看得清；画风本来就是粗描边）。 |
| [`art/tools/summon_scale.py`](../art/tools/summon_scale.py) | 召唤兽 / 怪物：三张动作表之间的大小是否一致（切帧按每张表自己的站姿参考格定比例，个别表会整体画大 / 画小）。 |
| [`art/tools/summon_strip.py`](../art/tools/summon_strip.py) | 召唤兽的游戏内比例连拍：按 spr.json 的锚点和 res 把帧换算成游戏里的大小，站在城镇背景上排一排，最左边放魔法师站姿做对照。 |
| [`art/tools/sword_art.py`](../art/tools/sword_art.py) | 鬼剑士（男）五个转职的美术数据：新动作表、特效、技能图标、转职立绘 / 觉醒插图、剑影的幻鬼。 |
| [`art/tools/witch_art.py`](../art/tools/witch_art.py) | 魔道学者的机械 / 召唤物美术（魔法师对齐组）：和 sky_art.py 同一套流水线（参考立绘 → 动作表 → 切帧），另外支持自定义帧名的动作表。 |
| [`art/tools/witch_art2.py`](../art/tools/witch_art2.py) | 魔道学者的图标 / 觉醒插图 / 一觉 4 台机械 / 四个助手的立绘（沿用 combatgen.py 的画风和调用；一次只跑 1 路，另一路给 witch_art.py）。 |
| [`art/tools/witch_batch.sh`](../art/tools/witch_batch.sh) | 魔道学者美术批量（两路并发，每路串行）： |
| [`art/tools/witch_cellfix.py`](../art/tools/witch_cellfix.py) | 动作表单格返修：从 3×3 动作表里裁出第 i 格 → gpt-image edit → 把修好的主体缩放到和原格主体一样高、脚底中心对齐，贴回去 |
| [`art/tools/witch_contact.py`](../art/tools/witch_contact.py) | 魔道学者新美术的总览（一张图给主线程审）：技能图标 → 觉醒插图 → 各机械 / 召唤物的游戏比例连拍（先跑 witch_strip.py）。 |
| [`art/tools/witch_dehalo.py`](../art/tools/witch_dehalo.py) | 去掉逐帧精灵外圈“烤进去”的光晕（浅色半透明的一圈）：从图边出发，穿过透明和浅色像素做洪水填充，碰到深色描边就停； |
| [`art/tools/witch_strip.py`](../art/tools/witch_strip.py) | 魔道学者的机械 / 召唤物：游戏内比例连拍（复用 summon_strip.py，帧顺序按各自的帧名），最左边放魔法师站姿做对照。 |
| [`art/tools/witch_wpn.py`](../art/tools/witch_wpn.py) | 魔道学者骑扫把帧的武器轨迹修正（切帧之后跑一次；重复跑没有影响）。 |
| [`art/tools/witch_wpncheck.py`](../art/tools/witch_wpncheck.py) | 按 spr.json 的武器轨迹把扫把合成到魔道学者的帧上（和 models/avatar.js 的长杆画法一致），基础造型 + 6 套时装各一行。 |

