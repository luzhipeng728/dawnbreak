# 联机设计（账号 / 云存档 / 同屏 / 组队刷图 / PK）

用户（项目所有者）的原话是：“联机一起玩是我最想要的。”目标是他和朋友能用各自的账号登录，在城镇里互相看见，组队一起刷地下城，并且能互相 PK。

## 总体结构
- **服务端**：新建 `server/`（Node.js，纯 JS，不要打包工具）。
  - HTTP API 放在 `/api/*`，实时通信走 WebSocket `/ws`。
  - 数据库用 SQLite。
  - 部署在 cc 服务器（dnf.cc.l-hate.com）。进程只监听 `127.0.0.1:18790`，由 Caddy 反代 `/api/*` 和 `/ws`；Caddy 的配置由主线程来改。
  - 服务器环境：系统 Node 是 v18.19.1，磁盘剩余约 4.8G。
    - SQLite 可以用 better-sqlite3（有 linux-x64 / node18 的预编译包），也可以在 `/opt/dawnbreak-server/runtime/` 放一个便携版 Node 22，改用内置的 `node:sqlite`。服务端组自己选，并写清楚理由。
- **客户端**：新建 `src/net/*.js`（加进 src/ORDER）。
  - 没登录也能照常单机玩：离线单文件版、不登录的网页版都保持现状。
  - 登录后使用云存档，联机功能只在登录后出现。
- **信任模型**：朋友之间玩，不做反作弊。但服务端要做基本校验：鉴权、限流、消息大小上限、房间成员校验。

## 账号与云存档（服务端组负责）
- **注册 / 登录**：
  - 用户名加密码，密码用 scrypt 哈希。开放注册，不需要邀请码（每个 IP 每小时限注册 30 次）。
  - 会话用随机 token（存数据库，30 天有效），客户端存在 localStorage，请求时放在 `Authorization: Bearer`。
- **接口**：

  | 接口 | 作用 |
  |---|---|
  | `POST /api/register {user, pass}` | 注册 |
  | `POST /api/login {user, pass}` | 登录，返回 `{token, user}` |
  | `POST /api/logout` | 登出 |
  | `GET /api/me` | 当前用户 |
  | `GET /api/saves` | 返回整个存档（`{v, cur, chars}`，和本地存档结构一样）以及 `updatedAt` |
  | `PUT /api/saves {data, baseUpdatedAt}` | 覆盖存档。`baseUpdatedAt` 过期时返回 409，客户端提示冲突并让玩家选择 |
  | `GET /api/friends` | 好友列表 |
  | `POST /api/friends {user}` | 发送好友申请 |
  | `POST /api/friends/accept {user}` | 同意好友申请 |
  | `DELETE /api/friends/:user` | 删除好友 |
  | `GET /api/inspect/:uid?cid=&char=` | 查看别人（server/modules/inspect.js）：只返回一个角色的公开字段——名字 / 职业 / 转职 / 等级 / cid、装备（白名单字段）、图鉴登记的 key、公会名 / 等级 / 已解锁公会技能；不返回金币、点券、背包、仓库、金库、任务、账号信息 |

- **客户端存档**：`save.js` 由主线程授权服务端组改动。
  - 登录后以云端为准，写存档时防抖（2 秒）上传。
  - 第一次登录时，如果本地有角色，提示“上传本机角色到账号”。
  - 断网时先写本地，恢复后再同步。
- **界面**：
  - 标题界面：“登录 / 注册 / 不登录直接玩”。
  - 系统菜单：账号信息、登出。
  - 好友列表：独立窗口，显示在线状态。
  - 统一放在 `src/net/account.js`、`src/ui/login.js`、`src/ui/friends.js`。

## 后台管理（/admin，09-30）
- 页面：`/admin/`，服务端托管 `server/admin/` 下固定的 3 个文件（index.html / admin.css / admin.js，无框架、无外部脚本），带 CSP（`script-src 'self'`、`frame-ancestors 'none'`）；线上 Caddy 要把 `/admin`、`/admin/*` 也反代到服务端（`server/deploy/Caddyfile.snippet`）。
- 登录：用 `DNF_ADMIN` 里的游戏账号走 `POST /api/login`，拿到的 token 放在 `Authorization: Bearer` 头里（不用 cookie → 没有 CSRF）；不是管理员的账号登录后立刻登出并提示。页面上所有玩家提供的文字（用户名、角色名、邮件标题、报错消息）都用 textContent 显示，不用 innerHTML / eval。
- 接口全部 `{ admin: true }`：没登录 401、普通玩家 403（`server/test/admin.mjs` 逐个检查）；写操作都进操作日志 svc_log（detail 带 `uid` = 被操作的账号），敏感操作单独限流。

  | 接口 | 作用 |
  |---|---|
  | `GET /api/gm/stats?tz=` | 概况：总注册 / 封禁 / 删除、近 30 天每天注册数、24 小时 / 7 天登录、在线、职业 × 转职分布、等级分布、客户端报错数和前 5 条、服务器（协议版本、网页版本、运行时长、内存、数据库大小、物品目录） |
  | `GET /api/gm/users?q=&filter=&sort=&dir=&page=&size=` | 账号列表：q 搜用户名 / 角色名 / IP / #ID；filter = active（默认，不含已删除）/ banned / online / deleted / all；sort = id / name / created / login / lvl / chars / cera / gold |
  | `GET /api/gm/users/:id` | 详情：注册 / 最近 IP、在线状态、云存档摘要（角色、装备、背包格数、点券、金库）、最近 50 封邮件、登录会话、相关日志、客户端报错 |
  | `POST /api/gm/users/:id/ban {on, reason}` | 封禁（立即踢下线、作废所有登录）/ 解封；管理员账号不能封（10 秒内 30 次） |
  | `POST /api/gm/users/:id/logout` | 踢下线：作废全部会话 + 断开 WS；不能踢自己 |
  | `POST /api/gm/users/:id/password {pass}` | 管理员重设密码（6~64 位），旧登录全部作废；不能改管理员的（1 分钟 10 次） |
  | `POST /api/gm/users/:id/delete {confirm: 用户名}` | 软删除：先 `VACUUM INTO` 整库备份到数据库目录的 `backups/`，再停用 + 标记 `deleted_at`（数据保留）；10 分钟 5 次 |
  | `POST /api/gm/users/:id/undelete` | 恢复（仍是封禁状态，要再解封） |
  | `GET /api/gm/regs?days=&limit=` | 最近注册（注册 IP、第一个角色、同 IP 账号数）+ 同一个 IP 注册多个账号的汇总（3 个以上 flag） |
  | `POST /api/gm/mail {to, title, body, gold, cera, items, days, preview?, rid?}` | 发邮件（游戏里的“管理”窗口也用它）：to = 用户名数组 / 逗号分隔（最多 500）/ `'*'`（全体，不含封禁 / 删除）；点券单封上限 1000 万，超出自动拆成多封（标题加“（2/3）”，每次最多 2 亿）；`preview: true` 只返回人数 / 拆分 / 物品名字；`rid` 批次号防重复提交；有物品目录时校验 key |
  | `GET /api/gm/mails?limit=` | GM 邮件发送记录（带领取 / 已读进度，按批次号数 mail 表的 `rid = gm:<批次>:<uid>:<序号>`） |
  | `GET /api/gm/cerr?user=&q=&before=&limit=` | 客户端报错明细 + 最近 7 天按“位置 + 消息”分组 |
  | `GET /api/gm/online` / `POST /api/gm/notice {text}` / `GET /api/gm/logs?type=&user=&before=&limit=` | 原有接口（在线玩家多了 IP；日志多了 before 翻页） |

- 账号表多了 `reg_ip` / `last_ip`（注册 / 登录时写；老账号按最早 / 最近的会话补上）和 `deleted_at`（软删除）。
- 物品目录：`node build.mjs` 出网页版时 `tools/item_catalog.mjs` 在 Node 的 vm 里跑一遍网页版脚本（浏览器接口都换成空替身），读出 `ITEMS` / `CLASSES` / `SCENES`，写成 `dist/web/catalog.json`（约 340 KB，和浏览器里的 ITEMS 逐个 key 对过）。后台页面直接取 `/catalog.json`（物品选择器、职业 / 场景名字）；服务端用 `DNF_CATALOG`（线上 `/opt/dawnbreak/catalog.json`，本地 / 测试用 `DNF_STATIC` 下的）校验物品 key，读不到就只校验格式。
- 测试：`node --disable-warning=ExperimentalWarning server/test/admin.mjs`（接口，约 3 秒）、`node test/admin_console.mjs`（无头浏览器走一遍所有页签 + 封禁 + 发邮件 + 手机宽度，截图 `test/shots/admin/`，约 20 秒）。

## 实时通信（服务端组搭框架，联机玩法组实现玩法）
- 连接：`wss://<host>/ws?token=...`，消息是 JSON：`{ t: 类型, ...数据 }`。服务端每 20 秒 ping 一次，客户端断线后自动重连。
- 服务端框架提供：
  - **在线状态**：presence。
  - **场景频道**：同一个城镇场景的玩家互相广播。
  - **聊天**：世界 / 队伍 / 私聊。
  - **队伍**：最多 4 人，队长、邀请、加入、离开、踢人。
  - **房间转发**：地下城和决斗的实例房间。房主把消息广播给成员，成员的消息发给房主，服务端只做转发和成员校验。
- 具体消息类型由两组在协作板上约定，定下后写进本文件的“消息表”一节。

## 联机玩法（联机玩法组负责）
- **城镇同屏**：
  - 客户端以 10Hz 发送 `{scene, x, y, face, st, anim, look}`，`look` 是外观：职业、转职、武器、时装。
  - 其他玩家画成真实角色：用外观系统 `avatarCanvas` / SpriteModel，带插值平滑，头顶显示名字和等级，点击可以查看信息、邀请组队、发起 PK。
- **组队刷图**：
  - 队长选地下城，全队一起进（加载完一起开始），房间随队长一起切换，这是官方的做法。
  - 主机权威：队长的客户端模拟怪物 AI 和伤害结算，每个玩家本地模拟自己的角色，并把位置、动作、命中上报给主机。主机以 15~20Hz 广播怪物快照（位置、血量、状态、动作），另外单独发送事件（生成、死亡、房间清理、开门、领主死亡）。
  - 怪物打队员：主机按队员最后上报的位置判定，然后发送“你被打中了”事件。
  - 掉落和翻牌：每个人独立，各拿各的，不抢装备。
  - 怪物血量随人数提高：2 人 ×1.6、3 人 ×2.2、4 人 ×2.8（可调）。
  - 队员断线后自动离队，由主机继续模拟。队长断线时房间解散，所有人回城，本局的奖励照常保留。
- **PK（决斗）**：
  - 好友之间 1v1，发起方当主机：双方角色都在主机上模拟，另一方以 30~60Hz 发送手柄输入。战斗组已经把角色控制抽象成 `engine/pad.js`，可以直接接网络输入。主机以 30Hz 下发快照，客户端做插值，自己的角色做简单预测。
  - 沿用现有决斗场的规则和保护机制：三局两胜、伤害修正。
  - 入口：点击其他玩家发起，或者维尔·克鲁处的“好友决斗”。
- **延迟目标**：国内好友之间 100ms 以内体验顺畅，300ms 以内还能玩。要做延迟显示和断线提示。
- 测试：
  - 用 2~4 个无头浏览器，同一台机器、同一个本地服务端，自动测试同屏、组队进图、一起清房、领主死亡、结算、PK 一局。
  - 注意：同一时间最多开 4 个浏览器（用户电脑会发热），测完立刻关闭。

## 分工（2026-09-28 用户确认方案后）
| 组 | 拥有 |
|---|---|
| 联机（一个子智能体负责到底） | `server/` 核心（HTTP / WS / 数据库 / 鉴权 / 模块加载）、账号、云存档（`save.js` 云同步部分）、好友、聊天、城镇同屏、组队刷图、好友 PK、`src/net/*`、`src/ui/{login,friends,party,chat}.js`、`test/net_*.mjs`、`test/mp_*.mjs` |
| 社交与经济服务 | `server/modules/{auction,mail,rank,notice,signin,gm}.js`（挂在联机组提供的模块扩展点上）、拍卖行 / 邮件 / 排行榜 / 全服公告 / 签到 / 管理员后台的客户端窗口 `src/ui/social/*`、`test/svc_*.mjs` |
| 商城与礼包 | 点券体系、商城、时装与天空套合成、宠物 / 光环 / 武器装扮、礼包与多买多送、魔盒和各类箱子、`src/game/shop*.js`、`src/content/cash/*`、`src/ui/cash/*` |
| 装备深化 | 更多神器 / 传说 / 史诗与史诗套装、深渊派对、增幅、锻造、附魔宝珠机制、装备图鉴；物品相关文件（`game/items.js`、`content/items/*`、`ui/items/*`） |
| 主线程 | cc 服务器部署（systemd、Caddy）、合并、全套回归 |

- 服务端模块扩展点由联机组第一时间提供，约定写在协作板上：`server/modules/*.js` 导出 `{ routes, onWs, migrations }` 之类，由联机组定义。社交组先做客户端和设计，等扩展点就绪后再接服务端。
- 数据归属：
  - 角色存档（含背包、点券）存在云存档里。
  - 拍卖行、邮件、排行榜、公告这类跨玩家的数据存在服务端数据表里。

## 实现记录（联机组，分支 worktree-agent-a88ded703a4bf2b36）

### 服务端（M1）
- 运行环境：便携版 Node 22 + 内置 `node:sqlite`（理由：零原生依赖，不用在服务器上编译或下载与 Node 18 ABI 对应的 better-sqlite3；系统 Node 18 不动）。唯一依赖 `ws`。部署见 `server/deploy/DEPLOY.md`。
- 结构：`server/index.js`（入口、模块加载）、`server/lib/`（数据库、HTTP 路由、WS 连接中心、限流）、`server/core/`（account / saves / social / party / room，和扩展模块用同一套接口）、`server/modules/`（其他组的扩展模块，自动加载）。扩展点接口见协作板“服务端模块扩展点”一条。
- 账号：scrypt 哈希；token 32 字节随机数，数据库只存 sha256；30 天有效、使用中每天续期；邀请码 = `DNF_INVITE`（可重复用）或管理员生成的一次性码（invites 表）；`DNF_ADMIN` 指定管理员。
- 云存档：`PUT /api/saves {data, baseUpdatedAt, force?}`，版本不一致返回 409。每个账号保留最近 20 份历史（最多 10 分钟一份）。存档里多存了两个字段：`bank`（账号金库，登录后按账号同步）和 `_rev`（客户端内容编号）。
- 安全：每 IP 10 秒 120 个请求；登录 10 分钟 20 次（按 IP）/ 10 次（按用户名）；注册 1 小时 6 次；请求体默认 64 KB（存档 4 MB）；WS 单条 64 KB、每连接 3 秒 300 条（持续超出断开）、每 IP 每分钟最多新建 20 条连接；5 秒内不鉴权就断开；同一账号新连接顶掉旧连接；房间转发只在成员之间。
- 掉线宽限：`DNF_GRACE_MS`（默认 20 秒）内重连，队伍和房间都保留（决斗 10 秒）。

### 客户端（M1）
- `src/net/net.js`：`net.api / net.on / net.send`、自动重连（0.8 秒起指数退避，最多 10 秒；浏览器 online 事件立即重连）、每 2 秒 ping 测延迟（9 秒没回音当作断线）。页面加载时先请求 `/api/health`，通了才显示登录入口（离线单文件、没有服务端的静态托管保持原样）。
- `src/net/account.js`：云存档。登录后存档键换成 `dawnbreak_cloud_<uid>`（金库 `dawnbreak_bank_cloud_<uid>`），`save.persist()` 通知改动，防抖 2 秒上传；断网写本地，恢复后退避重试补传；409 时先看云端的 `_rev` 是不是自己早先传的（关页面时回应丢失的情况），是就继续传，不是才弹“使用云端存档 / 用本机覆盖云端”。第一次登录时提示把本机角色上传到账号（名字重复自动加后缀，超出角色位的不传）。`netSaveFlush()` 立即上传。
- `src/ui/login.js`：标题的“登录 / 注册 / 不登录直接玩”、登录注册窗口、账号窗口（同步状态、立即同步、导入本机角色、改密码、登出）、系统菜单里的账号信息与登出。
- `save.js` 改动：写 localStorage 的两处合并成 `save.persist()`，末尾调用 `cloudSave.changed()`。

### 组队刷图（M3，`src/net/coop.js`）
- **和原设计的差别（联机组优化，已说明理由）**：怪物打队员改成**挨打的人自己判定**（原设计是主机按队员上报的位置判定）。主机仍然是怪物的唯一权威（AI、位置、血量、死亡、清房、开门），但主机上怪物出招时会广播“出招事件”，队员那边的傀儡怪播放同一个招式（预警、特效、投射物都一样），命中只对“我自己”生效。理由：延迟 100ms 时，按上报位置判定会出现“我明明躲开了还挨打”；自己判定则躲闪 / 无敌帧的手感和单机一样。信任模型是朋友之间，不做反作弊。
- 打怪：谁打谁判定（打的是自己屏幕上看到的位置），队员把伤害、暴击 / 破招、受击反应参数（浮空 / 击退 / 硬直 / 倒地追击等）和异常状态发给主机；主机扣血、做受击反应，并把伤害数字随快照转给其他人。傀儡不会在队员本地死亡，等主机的击杀事件。
- 队友：每人 20Hz 广播自己的位置 / 状态 / 动画片段 / 血蓝；其他人用“影子”显示，出招时影子重放同一个技能（只有特效，不造成也不承受伤害，`combat.js` 的 applyHit 开头判断 ghost）。队友的觉醒不会冻结别人的画面。
- 怪物的目标：主机上每只怪在活着的玩家里选最近的（2.2 秒内不换，带一点随机），AI 和出招期间 `game.player` 临时换成它的目标，所以现有怪物代码不用改。
- 奖励：主机广播击杀事件，每个人各自走 `dungeon.onKill`（经验、金币、`rollDrop`、任务计数），翻牌各翻各的。组队时结算界面没有“再次挑战”。
- 断线：主机的生成 / 击杀 / 换房间 / 清房事件带序号并保留最近 600 条；队员重连后要一次补发（奖励不丢）并对齐房间和怪物；主机自己断线期间这些事件先排队、重连后补发；快照显示主机在别的房间超过 1.5 秒时队员自动跟过去。队员掉线超过宽限期 → 离开房间（主机继续）；队长掉线超过宽限期 → 房间关闭，队员回城（奖励保留）。
- 主机页面切到后台时浏览器不画帧：收到队友消息时补跑逻辑（`coop.bgStep`），怪物照常动。
- 改动的主线程文件：`game/dungeon.js`（构造参数 seed / roomSeeds / guest / hpMul，队员不刷怪、不判定清房）、`engine/combat.js`（applyHit 第一行 ghost 判断）。
- 其他组的约定：`netIsGuest()`（装备深化的深渊波次）、`DUNGEONS[id].beforeEnter(diff)` 各自扣票、`cashLook` / `cashAttach`（商城外观）。

### 好友决斗（M4，`src/net/pvp.js`）
- 发起方当主机，直接复用 `game/duel.js`（三局两胜、每局 60 秒、天平属性、PvP 伤害修正和保护机制、燃斗模式）。
- 对方每个逻辑帧记录手柄输入（按住 + 按下，21 个动作的位掩码），每 2 帧打包发一次（30Hz）；主机每帧从队列取一帧塞进对方角色的 `Pad`，按键顺序不丢（↓→Z 这类指令照样能搓）。队列超过 8 帧时先丢掉只有“按住”的帧追上。
- 主机 30Hz 下发快照（双方位置 / 状态 / 动画片段和时间 / 血蓝 / 霸体 / 保护条 / 燃斗 / 回合 / 计时 / 提示文字）+ 出招事件；对方那边两个角色都是影子，重放招式特效（觉醒的定格和插图两边都能看到）。自己的角色：可自由移动时先按本地方向键走，再向主机位置（按延迟外推）平滑校正；对手按快照插值。
- 决斗不碰存档：开始前存一次档并停写（`save.live = false`），消耗品快捷栏临时清空；结束 3.5 秒后双方按存档重新进城（`startGameNow`）。
- 结束时两边都 `bus.emit('pvpResult', { win, vs: 对方用户名, wins: [我, 对方], draw })`。
- 掉线：宽限期 10 秒，超时算“对方掉线，决斗结束（不计胜负）”，不发 pvpResult。
- 入口：城镇里点其他玩家 / 好友窗口的“决斗” / 决斗场窗口（维尔·克鲁、P 键）里的“好友决斗”一栏。

## 消息表（WS，JSON `{ t, ... }`；`r` 是房间转发，里面的 `d.k` 是玩法消息）
| 方向 | t | 字段 | 说明 |
|---|---|---|---|
| 客户端→服务端 | `auth` | token, ver, build | 连上后第一条（5 秒内），ver 不一致 → 4002 断开 |
| 服务端→客户端 | `welcome` / `error` / `kicked` | user, serverTime / code, msg / msg | 鉴权结果；被顶号 4003、被停用 4004 |
| 双向 | `ping` / `pong` | ts | 客户端每 2 秒一次测延迟，9 秒没回音当断线重连 |
| C→S | `hello` | char { name, cls, job, lvl, look { wpn, set, acc, cash }, hp } | 当前角色信息 |
| C→S | `scene` / `pos` | id\|null, x, y, f / x, y, f, s | 城镇场景频道与 10Hz 位置 |
| S→C | `peers` / `penter` / `pleave` / `pos` / `pchar` | | 同场景其他玩家 |
| 双向 | `chat` | ch: world\|party\|whisper\|sys, text, to, from { id, name, cname } | 聊天；`chatlog` 是上线时补的世界频道记录 |
| S→C | `friend:req` / `friend:ok` / `friend:del` / `friend:on` | | 好友（增删改走 HTTP `/api/friends`） |
| C→S | `party:invite` / `party:accept` / `party:decline` / `party:leave` / `party:kick` / `party:lead` | to / from / from / – / id / id | 队伍 |
| S→C | `party` / `party:invited` / `party:declined` / `party:note` | party\|null, why / from, size / by, why / text | 队伍状态以服务端为准 |
| C→S | `room:open` / `room:leave` / `room:close` / `r` | kind:'dungeon', meta / – / why / d, to? | 实例房间；`r` 不写 to：房主→全体、成员→房主；to:'all' / userId |
| S→C | `room` / `room:closed` / `room:left` / `room:lag` / `r` | room, resume? / why / user / user, on / f, d | resume = 宽限期内重连回来 |
| C→S | `duel:ask` / `duel:accept` / `duel:decline` / `duel:cancel` | to / from / from, why / to | 好友决斗邀请（20 秒过期） |
| S→C | `duel:asked` / `duel:declined` / `duel:cancelled` / `duel:note` | | |
| C→S | `arena:join` / `arena:leave` / `arena:end` | cid, char, pool? / – / id, win, draw, abort? | 决斗场排位（`server/modules/arena.js`）：排队 / 退队 / 上报结果（abort 1 = 没开打→作废，2 = 中途离开→判负） |
| S→C | `arena:queued` / `arena:left` / `arena:note` / `arena:match` / `arena:result` | rating, tier / why / text / id, ai, host, vs / id, win, draw, void, why, delta, rating, tier, reward | 真人对局随后收到 `room`（kind duel，`meta.arena` = 对局 id），走好友决斗的流程 |
| 双向 | `raid:*` | 见下面「团本」一节 | 团本会话（`server/modules/raid.js`） |

### 组队刷图（`r` 里的 d.k）
| 谁发 | k | 内容 |
|---|---|---|
| 队长 | `prep` / `go` / `drop` | 准备（地下城、难度）/ 开始（成员、地图种子、房间种子、血量倍率）/ 没跟上的队员 |
| 队员 | `ready` / `nope` | 加载好了 / 进不了（原因：疲劳、没有入场道具、不在城镇……） |
| 队长 | `s`（20Hz） | ts 这些位置是队长哪一帧的（队长的 performance.now）、rk 房间、m [[id, x, y, z, 朝向, 状态, 血, 出招序号]]、d 伤害数字 |
| 队长 | `spawn` / `ma` / `kill` / `room` / `clear` | 生成 / 怪物出招（招式下标、目标）/ 击杀（击杀者、最后一击）/ 换房间 / 清房（前后 4 种带序号 sq） |
| 队长 | `sync` / `replay` | 重连对齐（当前房间、清过的房间、活着的怪）/ 补发错过的生成和击杀 |
| 队员 | `hb` / `st` / `door` / `resync` | 命中打包（伤害、暴击、破招、受击反应；抓取 `g` 1 抓住 / 0 放开 / 2 投掷，见“男格斗家”）/ 异常状态 / 请求进门 / 请求补发 |
| 所有人 | `p`（20Hz）/ `a` | 自己的位置（带 ts，同上）/ 状态 / 动画 / 血蓝 / 房间（格斗家多带 `ff` 职业状态）/ 出招（技能 id + 等级、普攻名、闪避……） |

### 好友决斗（`r` 里的 d.k）
| 谁发 | k | 内容 |
|---|---|---|
| 对方 | `dk` / `dready` / `in` | 自己的职业、转职、技能等级、技能栏、外观 / 加载好了 / 输入帧 [[按住位掩码, 按下位掩码], …] |
| 主机 | `dstart` / `ds`（30Hz）/ `da` / `dend` | 双方配置 / 快照（ck 主机帧时间、iq 已处理的对方输入帧数）/ 出招 / 结果（winner 0=主机 1=对方 -1=平局, wins） |

### 已知问题的处理（09-28 第二轮）
- **队员打浮空要等快照**：队员打中傀儡后本地立即预测——傀儡按单机的实体逻辑跑（重力、浮空、弹地、倒地、起身），追打会延长预测；恢复行动后再用较慢的插值回到主机位置，这段时间里快照里“晚一拍的同一次浮空 / 倒地”不再重播。预测中收到主机这只怪的出招（会被我的命中打断）不在空中重播。`mp_coop_more` 在 80ms 延迟下：打中到离地的时间和单机基准一样（含打击停顿），浮空连击全程在空中、位置不跳，落地后不会再浮空一次，停下后和主机位置误差 < 12px。
  - 2026-10（长连段被拉回）：以前预测上限在第一下就定死 4 秒、之后不延长（`coop.js` localHit），刷图取消浮空时限以后满连能到 10 秒，第 4 秒傀儡会被快照拉回主机状态（`mp_coop_more` 旧代码：6.5 秒长连被拉回 6 次）。现在每下把上限推到 `now + COOP_PRED_EXT`（4 秒），一套从第一下算最多 `COOP_PRED_CAP`（20 秒）；新一套开始时傀儡站着就 `resetCmb`（傀儡不预测时不跑起身结束的清零，残留的连击统计会让下一套一开始就进保护）。命中包带 `tz`（队员看到的怪的高度）：主机这边刚落地不到 `COOP_LAND_GRACE`（0.25 秒）、不是二级保护强制落地的，按空中受击结算一次（延迟造成的落地先后差，以前这一下被当成打倒地的高段直接丢掉）。测试 `mp_coop_more`：队员 6.5 秒长浮空全程在空中、没被拉回；主机这套命中都按空中受击；落地宽容的三种不吃的情况。
- **队员的抓取**：队员本地抓住 / 放开 / 投掷都按顺序排进命中包；主机用同样的规则（`canGrab`：领主、体重、刚被抓过、倒地、`noGrab`）再判一次，能抓就把怪挂到队员的影子上（`startGrab`，影子每帧 `holdGrabbed`，其他人看到“被抓”），抓不住就回 `gbx`，队员那边也放开。
- **自带 AI 的怪**：主机上用访问器包住怪物的 `control`，生成之后再换 AI（龙之雕像 `m.control = skyStatueAI`）也会先在全队活着的人里选目标。招式表以外的出招会带上 AI 函数名，队员那边用同一个 AI 函数在傀儡身上现场出招（事件、投射物都一样，打到的是被瞄准的队员）。排查过的自定义逻辑：`monsterAI` / `cowardAI`、龙之雕像、悬空城石像骑兵（苏醒按最近的人；队员也看到石像外观）、天帷巨兽的触手横扫 / 连砸 / 墨汁等延时攻击（施放时就记下目标）、神殿外围的大祭司护盾（队员看不到的受伤倍率由主机按比例补上）、第二脊椎的黑章鱼、石巨人操纵师死亡联动、猫妖 / 毒雾 / 放电等受击反击（队员本地也跑一遍，打到的是自己）、深渊派对（封印之门、三波、领主降临时重发生成信息）。
- **区域怪（技能库编译的招式）按编号重播**：`monSkill` 按定义时的编译顺序给每只怪的每一招编号（招式表 + 连招的每一步 / 格挡反击 / then 后续，`D.msAll`，每个客户端顺序一样），主机的 `ma` 带 `mi`，队员按编号放同一招（判定、事件、预警都一样）。以前连招的后续步骤不在招式表里，只能靠“队员那边跑一帧 AI 猜”，深渊领主外面又包了一层机制、AI 名丢了，暗杀者的瞬移 → 双斩 → 爆发在队员那边是空动作（打不到队员）。外面包了一层 AI 的写 `ctl.aiBase = 原 AI`，主机会往里找。
- **死的时候已经不算这张图领主的怪**（深渊领主）：`kill` 事件带 `b: 0`，队员那边不按领主结算（以前队员会清场、直接出结算界面，主机还在打）。
- **领主机制同步**（net/coop_mech.js，机制库 game/mon_skills.js 的 BOSS_MECHS）：主机上机制启动 / 结束 / 关键时刻调 `msNetEv` → 可靠消息 `{ k: 'mech', id, u, e, use?, p?, d? }`（启动带参数和随机结果：安全区光圈位置、分身 / 水晶 / 搭档的编号……；一轮落石 / 地火带位置；护盾惩罚、分身惩罚、破招、狂暴、属性切换是事件）；破招槽、护盾值这类 HUD 数值变了才发（最快 200ms 一次）；队员重连时随 sync 补发还在进行的机制。队员那边每种机制有 `mirror`（start / ev / update / end）：同样的预警、文字、倒计时，攻击只判定自己（谁挨打谁结算）；结果只认主机（护盾破没破、水晶打完没有、无敌解除、属性切换）。傀儡本地不启动机制（`msMechStart` 里挡掉 `m.puppet`，生成时自带的也作废）。
  - 属性法阵的伤害倍率按人算：主机本人按自己站的位置（`msSelf()`，AI 执行期间 `game.player` 是目标，所以 coop 的包装里记 `game.realPlayer`），队员的命中按队员影子的位置（remoteHit 里 `msElemMulFor`）。
  - 领主钩子（REGION_HOOKS）的一次性事件走 `msNetEv(m, null, 'hook', { h, tgE, … })`，钩子里写 `mirror[h](m, d)`（`tgE` 换成玩家编号，队员那边还原成“我自己 / 某个影子”）；需要本地计时的写 `mirror.tick(m, dt)`（队员每个逻辑步调，攻击记在 `hook:<钩子名>` 名下）。已接的：
    - 虫王戮蛊：钻地（预警跟着同一个目标，三圈冲击打队员自己）+ 下次钻地的倒计时。
    - 牛头械王：倒地起身的三道落雷（主机发位置和朝向）、罪恶之眼（先发两只眼睛的位置；眼睛刷出来以后再发一次激光的位置 / 朝向 / 眼睛编号，射完队员那边的眼睛傀儡也消失）、保护模式的全屏吼叫（队员这边按自己跳没跳判定眩晕）、机器人变牛头统帅（提示 + HUD），保护模式倒计时按镜像的已进行时间算。
    - 潜行者希洛克：凝视（主机睁眼时发剩余时间，队员这边同样睁眼，到点按自己的朝向判定自己；主机那边跳过队友的影子）+ 下次凝视的倒计时。
  - 房间机关（不挂在领主身上的）：同样走 `msNetEv(怪, null, 'hook', { h })`，队员调 `MS_MIRROR[h](傀儡, d)`（game/mon_skills.js）。比尔马克伊凡房：伊凡 / 伊凡上校的自爆（跟着傀儡的预警，炸的是队员自己，死亡以主机的击杀为准）、最后 4 秒的倒计时、上校变红的提示。只和队员自己有关的持续部分写在房间脚本的 `guest(dg)` / `guestDraw(c, dg)`（队员进房间时跑）：路障挡住队员、统帅房的减伤连线；房间提示（say）队员也弹。
  - 主机上长期无敌的机关（invul > 5：路障、召唤柱、罪恶之眼、深渊门锁）：队员的命中在 remoteHit 里丢掉（`hitDrop.invul`），以前队员能把路障 / 柱子打掉。
  - 跟着领主画的常驻特效（护盾泡泡、属性光圈、连线、贴近型安全区）用 `msLive(m)` 按编号找现在的傀儡：领主藏起来（`msHide`）超过 1.5 秒，队员那边的傀儡会被移除，出来时重建，以前护盾泡泡留在旧位置；藏着的时候不画（`msShown`）。
  - 还没接：悲鸣洞穴的房间机关（紫色法阵的范围、虫王进食洞口）在队员那边看不到（结果以主机为准，不影响挨打）。
  - 区域怪的死亡爆炸特性（`onDeath: 'explode'`，爆裂暗影、RX-78）：队员收到击杀时在傀儡的位置也炸一次。
  - 怪物出招前先发排队的生成信息（`monAct` 里 `flushSpawns`），刚召唤出来就出招的怪不会因为“队员还没有这个傀儡”丢招。
  - 测试：`node test/mp_abyss.mjs HN,HA,HG`（三个深渊领主 + 普通区域领主 GT-9600 / 虫王戮蛊：机制启动一一对应、地面预警一个不少且时间差 < 0.3 秒、安全区队员到点判定自己、队员被机制打中）；`node test/mp_bosses.mjs [MK,SR,RM]`（牛头械王 / 潜行者希洛克 / 伊凡房：钩子事件一一对应且时间差 < 0.3 秒、地面预警配对、队员被落雷 / 激光 / 凝视 / 自爆打中、被吼叫震晕，希洛克藏起来再出来后护盾泡泡跟着重建的傀儡，路障挡人、打路障不算伤害）。
- **服务端重启**：服务端 `welcome` 带启动编号；客户端发现编号变了 → 队长 / 决斗发起方 `restore:host { party, room }`，其他人 `restore:claim { host }`；双方对上才加入（名单外的人认领无效），被认领的人收到 `room { resume, restored }` 接着玩（队员要一次补发，对齐房间和怪物）。限时（`DNF_RESTORE_MS`）内没回来的成员，房主收到 `room:left { why: 'timeout' }`。决斗在任一方断线期间暂停（计时不走），恢复后继续；恢复不了的给出明确提示再回城。
- **深渊邀请函**：进图时对比 `beforeEnter` 前后的背包记下消耗；进图没成功（取消、没建好房间、队员没跟上、服务端重启）就原样退还。深渊领主（每次随机）以队长为准，队员按它加载素材。

### 决斗场排位（`server/modules/arena.js` + `src/net/arena.js`，09-28）
- 匹配：积分差 100 起，每等 1 秒 +30（最多 600）；同账号只能排一次；5 分钟内打过的两个账号不再匹配；断线 / 进地下城移出队列。等 12 秒（`cfg.arenaAiMs`）没人 → AI 对手（18 种职业 / 转职随机、像玩家的名字 +「AI」、积分在附近、难度按段位 1..3），客户端用 `game/duel.js` 本地打完上报。
- 积分：Elo，K = 32，新角色 1000；段位 青铜 / 白银 1100 / 黄金 1300 / 白金 1500 / 钻石 1700 / 斗神 1900。**AI 局积分 × 0.5，白金以上赢 AI 不加分**（防刷，天梯上半段只能打真人）。
- 结果：真人局双方各报一次，一致才结算，只有一方报就等 `cfg.arenaReportMs` 按它算，对不上作废；排位房间关闭时（`room.closeHooks`）还没结果：开打 30 秒内作废，之后走掉的一方判负。AI 局没报完就重新排队 / 超时 6 分钟 = 判负。对局记在 `arena_match`，服务端重启后结果照样能结算。
- 奖励：系统邮件，每胜 2000 金币（AI 1000，每天前 10 胜）+ 5 点券（每天最多 30），每日首胜 +5000 金币 +20 点券。
- 排行榜：`GET /api/rank?board=arena`；个人：`GET /api/arena?cid=`。


### 决斗的操作延迟：对方的角色改成本地模拟（09-29）
- **问题（实测，`node test/mp_duel_lag.mjs`）**：原来对方（队员）只发按键，主机模拟双方、再把出招事件发回来，对方按下键要等一个完整来回才看到自己出招：本机 60ms、每人往返 60ms 时 178ms、往返 120ms 时 295ms（中位数，普攻和技能一样）。多出来的 60ms 是输入 2 帧一包、主机按帧取队列、再等下一帧画出来。
- **做法（本地预测 + 主机裁决）**：对方页面上自己的角色不再是影子，而是真正的本地角色（`pad = input`、`playerControl`、完整的实体物理），按键当帧出招 / 移动；对手仍是影子，`applyHit` 两边都不结算，伤害、受击、浮空、抓取全由主机决定。
  - 主机快照多带 `iq`（对方的第几帧输入已经处理完）和 `ck`（快照是主机哪一帧的）。对方每帧记下“这帧输入之前”的本地位置，收到快照时用主机位置和本地同一帧的位置比，扣掉那之后已经做过的校正，剩下的误差分几帧补上（>150px 直接对齐）。
  - 主机发来的自己的出招事件 `da`：本地已经出过同一招（技能 id / acts 键 / back）就对上号、不重播；本地没出过（冷却 / 状态判断不一致）就以主机为准补上。本地先出的招，主机处理完那帧后 15 帧还没出，本地收回。
  - 冷却取本地和主机较长的、MP 取较少的（主机数据晚一个来回，不知道本地刚放的技能）。
  - 主机说自己在受击 / 浮空 / 倒地 / 起身 / 被抓 / 死亡，或回合不在进行中 → 切成“跟随主机快照”；主机那边恢复自由行动后再切回本地。
- **结果**：按键到自己出招 p90：往返 0 / 60 / 120ms 都是 ≤16ms（下一帧就画出来）；每次出招只播一次、和主机出的是同一招；按住方向键走 1 秒每帧位移最大 3.6px、没有往回拽；停下后和主机位置差 0px；挨打时跟随主机、恢复后回到本地操作。
- 还剩的：对手的动作仍然晚一个来回才看到（它由主机模拟），命中以主机为准——本地看起来躲开了、主机判定打中时，会在一个来回后切到受击。主机自己零延迟，比对方占一点便宜。
- 顺带：组队的 `s` / `p` 和决斗的 `ds` 带发送方的帧时间，接收方按它插值（偏移 = 到达 − 发送的最小值，插值延迟 = max(100ms, 发送间隔 + 一帧 + 抖动)）。以前按到达时间插值，发送定时器 25ms 一跳、位置又是上一帧的，间隔忽长忽短；加上网络抖动，匀速跑的队友会一顿一顿。`node test/mp_smooth.mjs 40 0,40,80,150`：抖动 0~150ms 时影子速度波动 0.45 → 0.31（队长自己跑是 0.34），跳帧 0.3% → 0。城镇（`pos`）是服务端转发的新消息，没带时间戳，这次没改（城镇 10Hz、人少，实测 4 人 60fps）。

### 回滚网络（GGPO 式）评估（09-29，这次不做）
- **要什么**：两边只交换输入，各自模拟全部角色；收到晚到的输入时回到那一帧、重放到现在。前提：
  1. **确定性**：同样的输入必须得到同样的状态。现在 `game/` `engine/` `content/` 里有约 755 处 `Math.random / rnd / pick`（暴击、AI、掉落、技能随机落点……），要分出“玩法随机”（换成带种子、可存可恢复的 RNG）和“纯表现随机”；`Math.sin / exp / pow` 在不同浏览器（Chrome / Safari）末位可能不同，长时间会漂移，要么定点化，要么每隔一段时间用主机状态校正（混合方案）。
  2. **固定步长**：`step(1/60)` 已经是固定步长，但有 `game.slowmo`、`game.timeStop`、`game.after` 计时器、少数逻辑读 `performance.now()`（4 个文件），都要改成只看逻辑帧。
  3. **存档 / 回档（snapshot / restore）**：每帧要能把全部状态存下来再恢复——实体、动作、投射物、地面效果、召唤物、异常状态、BUFF、冷却、计时器、RNG。难点在动作：约 321 个技能的 `act(lv, p)` 返回带闭包（`update / events / onEnd` 里捕获的局部变量）的对象，没法深拷贝，得把动作改成“纯数据 + 纯函数”，等于重写战斗层。
  4. **重放时的副作用**：回滚重放的那几帧不能出声音、飘字、震屏、生成特效（或事后去重）。
  5. **性能**：延迟 120ms ≈ 回滚 7~8 帧，每帧最多重放 8 次 step；决斗 step 约 0.3ms（CPU ×4 时 1ms+），手机上吃紧。
- **工作量**：确定性审计 + 动作系统改成可序列化 + 状态存取 + 不同步检测工具，按现在的代码量估 3~4 周，还会碰到所有职业的技能文件（15 个转职），回归面很大。
- **结论：现在不值得。** 朋友之间往返 30~80ms，这次的本地预测已经把“自己按键到出招”降到一帧以内；回滚能额外解决的是“对手的动作晚一个来回”和“主机零延迟的优势”，代价是重写战斗层。以后真要做排位公平性，先做便宜的：主机自己的输入也延迟 `对方往返/2` 再执行（双方同样的输入延迟），再考虑回滚。

### 男格斗家（09-30，B9：抓取 / 投掷的主机同步、职业状态、排位 AI 池）
- **队员抓主机的怪**（net/coop.js 抓取段）：抓住的命中包多带 `gd`（这一下能抓倒地的）和 `gm`（这一下最多抓几个）；主机用同样的 `canGrab` 规则判（带上 grabDown），多抓时不再先放开前一个（追加到 `grabMore`）；主机抓不住回 `gbx`，队员只放开那一只（以前是全部放开）。
- **投掷**（`throwArc`，柔道家抛投 / 浮空凌云踢、街霸……）：队员本地照常飞（飞行期间傀儡按本地物理走，不跟快照），同时发 `{ g: 2, x1, y1, h, du, dir }`；主机从怪现在的位置按同样的高度 / 时长飞到队员算好的落点（`other: false, hit: false`：撞人 / 落地伤害仍由队员的命中包结算），实测落点误差 0px。队友影子重放招式时不扔（`throwArc` 对影子直接返回），免得主机上和影子的重放各扔一次。
- **职业状态**（新文件 net/coop_fighter.js）：格斗家本人的 `p` 消息带 `ff = { b: 可见 BUFF, o: 念气珠位掩码, e: 风雷能量, q: 街霸 4 种投掷物的 [剩几个, 上限, 是否在装填] }`；影子按它增删 BUFF（影子上的 BUFF 不自己走时间，重放技能时加上的也以本人为准）、画念气珠 / 龙虎啸电光 / 焚步火焰 / 强拳红光，龙虎啸换普攻表（重放普攻时是虎爪），装填数照抄（重放投掷时强化 / 两连投的判断和本人一致）。念气罩本来就走 party_sync（`partyCast('fn_guard')`：每个人在自己那边生成罩子，站在里面各自无敌）。
- **排位 AI 池**（server/modules/arena.js）：`AI_POOL` 23 种；`arena:join` 带 `pool`（客户端已开放的“职业:转职”列表，`openClasses / openJobs`），服务端 `aiPoolOf` 只从里面抽，不带（老客户端）= 原来 18 种 → 格斗家没开放时不会排到格斗家 AI。
- 测试：`node test/mp_fighter.mjs [地下城] [等级] [转职]`（鬼剑士主机 + 柔道家队员：抓 / 扔 / 抓倒地 / 多抓、状态同步、念气罩、一起通关，约 1 分钟）；`node --disable-warning=ExperimentalWarning server/test/arena.mjs`（AI 池）。

### 团本（RA1，10-01：`server/modules/raid.js` + `src/game/raid_core.js`，设计见 `docs/RAID_PLAN.md` §3）
- **权威**：团本会话由服务端说了算；规则写在 `src/game/raid_core.js`（纯函数，不碰 DOM / 游戏全局 / 时钟，时间由参数传入，随机数带种子），浏览器按 `src/ORDER` 加载，服务端 `loadRaidCore()` 用 `node:vm` 跑**同一个文件**，离线单人（引导）在本地跑同一套。对外全局名只有 `RAID_DEFS` / `RAID_CORE` / `raidInit` / `raidEvent` / `raidTick`（const，重名直接报错）。
  - `raidInit(raid, members, mode, now, opt)` → 会话 S（纯 JSON）；`raidEvent(S, ev, now)` → `{ S, fx, err, ack }`；`raidTick(S, now)` → `{ S, fx }`；`RAID_CORE.view / graph / scale / canStart / limits / consume / rollReward / shift`。
  - 每条事件之前先按时间推进（计时、窗口、重生……），所以结果只取决于事件和它们的时间，和 tick 频率无关：`server/test/raid.mjs` 用同一串事件对比服务端 vm 和网页版脚本（dist/web 整个游戏一起加载）里的 `RAID_CORE`，逐步一致。
- **团本定义** `RAID_DEFS.siroco`（规则参数只写在这里，服务端只加载这一个文件）：两个阶段（追逐战 25 分钟 / 讨伐战 20 分钟，引导 40 / 30），节点图（`need` 前置、`type` = main / buff / timer / order / sync / final、`solo` 必须分头、`together` 最终合流、`dg` 节点地下城 id、`guide` 引导图里去掉或覆盖），跨节点效果 `fx`，复活（全团每阶段 6 次 / 引导 3 次，每人每节点 2 次），侵蚀 60 / 10 秒，休整 120 秒，补位 180 秒，次数每天 1 / 每周 2，数值 `scale`，奖励 `rewards`（RA3 填内容）。
  - 追逐战：`law_a` / `law_b`（顺序）→ `wit_dawn`（主线）+ `wit_night`（增益：哈妮尔受伤 +30%、免疫魅惑 90 秒，120 秒重生）→ `pain_mem`（主线）+ `pain_mirror`（倒计时 240 秒，到 0 → 记忆的碎片回满血 + 全团 −2 分钟；通关后修复 90 秒）→ `gate_l` / `gate_r`（同步：30 秒窗口，没同步复活 50%；血量差 > 25% 时血多的一边受伤 ×0.5）。
  - 讨伐战：`sub_a` / `sub_b` → `con_hall`（主线）+ `con_mut`（增益：幻影破防 20 秒、受伤 ×1.6）→ `coffin`（最终合流，主机报存档点）。
  - 引导图（单人，或普通模式只有 1 个人）：`law_a` → `wit_dawn` → `pain_mem` → `gate_l`（双领主 `raid_si_gate_duo`）/ `sub_a` → `con_hall` → `coffin`；普通模式 1 个人时用引导图但保留普通数值和奖励。
- **状态机**：`lobby`（建团 / 加入 / 准备）→ `routes`（阶段进行中）→ 阶段目标节点都通关 → `rest`（休整，领 P1 奖励；团长可以提前开始）→ `routes`（讨伐战）→ 最终节点开放时 `final` → `cleared`；阶段限时到 = `failed`（timeout），全员离开 = `failed`（abandon），大厅 30 分钟没人开始 = `failed`（stale）。
  - 节点状态：`locked` / `open` / `busy`（有人在打）/ `down`（同步节点等另一边）/ `cleared` / `cool`（增益重生、镜子修复）/ `off`（不再需要）。一个节点同一时间只有一次挑战（`run`）。
  - **补位**：普通模式里队友离线超过 180 秒（或离开了团本）→ 顺序不限、镜子暂停、双生窗口 90 秒、最终战可以一个人进；回来后恢复。挑战里的人全都离线超过 180 秒、而队友在线 → 放出这个节点（离线的人回来补发的旧结果会被拒）。
  - **防作弊（基本）**：只能进开放的节点、不能同时在两个节点、侵蚀中不能进；上报必须对上自己的挑战编号（一起打时 hp / down / clear / cp 只认主机）；领主倒下离进节点至少 `guard.minClear` 秒（20 秒 × 进场时的血量比例）；存档点掉血不能快过 `guard.maxDrop`（每秒 5%）；每次挑战的倒下只认一次，挑战结束后的上报被拒；`q` 序号重复的补发回 dup、不重复生效。
- **HTTP**：`GET /api/raid?cid=&raid=siroco` → `{ raid, limits { dayLeft, weekLeft, ok, nextDay, nextWeek, … }, run（进行中的会话，没有是 null）, invite（队长建了普通团本、我还没加入）, defs, now }`。
- **WS（C→S）**
  | t | 字段 | 说明 |
  |---|---|---|
  | `raid:create` | raid, mode 'normal' \| 'guide', cid, char { name, cls, job, lvl } | 建团：普通模式要是队长（或没组队），队伍不超过 2 人；Lv60 起；队友收到 `raid:open` |
  | `raid:join` | sid, cid, char | 加入（要和团长同队，大厅里） |
  | `raid:ready` | on | 准备 |
  | `raid:start` | – | 团长：大厅 → 追逐战（这时按角色扣每天 / 每周次数，用完的人本次是练习 `rw:false`）；休整中 = 提前开始下一阶段 |
  | `raid:leave` | – | 离开（开始后 = 放弃，次数照扣；只剩 0 人 = 失败） |
  | `raid:enter` | node, with?: [uid] | 进节点；`with` = 一起进（发的人要是队长、成员同队），随后自己发 `room:open { kind:'dungeon', meta: { raid: sid, node, run } }` |
  | `raid:ev` | node, run, q, e, v | 实例上报（q = 这次挑战里自己的序号，从 1 递增；断线时排队、重连后原样补发）：`hp` v=0~1（主机，建议血量每掉 5% 报一次）/ `down` 领主倒下（决定性）/ `clear` 离开节点回营地（没报过 down 的先按 down 算，同步节点除外）/ `fail` v='retreat'\|'dead'\|'lost'（lost = 房间没了，不算侵蚀）/ `death` 倒下且不复活（侵蚀）/ `revive` 要一次复活 / `cp` v={ hp, ph }（最终战主机每 3 秒） |
  | `raid:mark` | uid, node | 团长给队友标目标 |
  | `raid:resume` | sid | 重连 / 刷新后要全量（连上时服务端也会自动发） |
  | `raid:claim` | sid, phase | 领阶段奖励（阶段通关、不是练习、没领过；重复领返回同一份 `dup:true`） |
- **WS（S→C）**
  | t | 字段 | 说明 |
  |---|---|---|
  | `raid` | run（`RAID_CORE.view`）, now, resume? | 全量：建团 / 加入 / 换阶段 / 重连时 |
  | `raid:d` | sid, now, set, nodes | 变化：`set` 里的字段整体替换，`nodes` 只含变了的节点（按 id 合并） |
  | `raid:entered` | sid, run, node, name, type, dg, boss, host, by, scale { mode, guide, sub, hp, atk, mech, lvl, penalty, … }, buffs, cp, hpStart, order, orderTurn, sub, deadline | 进节点成功（一起进的人都收到）：按 dg 进图，按 scale 调怪，hpStart / cp 从存档点出生，buffs 是已经生效的跨节点效果 |
  | `raid:ack` | sid, run, q, e, ok, res?（clear / down / heal / life / nolife）, dup?, code?, text? | 每条 `raid:ev` 的回执（客户端据此删掉排队的事件） |
  | `raid:fx` | sid, kind, node, p | 落到实例里的效果：`buff` / `groggy`（p { id, p { dmgTaken, noCharm }, dur, until }）/ `unbuff` / `heal`（回满）/ `revive`（双生复活 p.hp）/ `window`（另一边倒了，p.until 前打倒你的）/ `done`（节点通关）/ `life`（复活结果 ok, left）/ `erosion`（p.until）/ `closed`（挑战结束：主机走了 / 没人在线）/ `time`（v 秒）/ `phase`（阶段开始 / 完成）/ `sub`（补位开关）/ `mark` |
  | `raid:note` | sid, text, node?, code?, bad? | 提示（bad = 你的操作被拒，code 见上） |
  | `raid:end` | sid, ok, why（clear / timeout / abandon / stale / disband / left / gone）, phases | 结束 |
  | `raid:open` | sid, raid, mode, leader { id, name } | 队长建了普通团本，邀请你加入 |
  | `raid:claimed` | sid, phase, reward { phase, cards: [{ key, n }] }, dup?, limits | 领奖结果；客户端按 sid + phase 只入账一次 |
- **队伍**（`server/core/party.js` 加了 5 行）：队伍里有人在没结束的团本里时，不能移交队长；邀请 / 接受邀请只允许同一个团本的成员（大厅里没满 2 人时可以邀请新人）；在大厅里离队 / 被请离 = 离开团本。会话和队伍分开：队伍因掉线解散后会话还在，团本成员之间可以重新组队。
- **持久化**：`raid_run`（整个会话 JSON；每次状态变化立即写，hp / cp 最多每秒一次；没结束的会话每秒更新心跳 `beat`）、`raid_claim`（会话 + 账号 + 角色 + 阶段唯一，存奖励结果）、`raid_week`（按账号 + 角色 + 团本：日编号 / 当天次数 / 周编号 / 本周次数；北京时间 06:00 换日、周四 06:00 换周）。服务端重启：读回没结束的会话，所有计时按停机时长（现在 − beat）顺延，成员先算离线，连上后自动收到 `raid { resume }`。模块可以导出 `stop(ctx)`（index.js 关闭时调用，团本用它把没写的变化写掉）。结束的会话在内存留 10 分钟、库里留 7 天。
- **部署注意**：线上服务端目录里没有 `src/`，`loadRaidCore()` 依次找 `DNF_RAID_CORE` → 服务端 `lib/raid_core.js` → 仓库 `src/game/raid_core.js`；`tools/deploy.sh server` 要在同步 server 目录之后加一步 `rsync -az src/game/raid_core.js cc:/tmp/dawnbreak-server-src/lib/raid_core.js`（install.sh 会复制 lib/）。找不到时团本模块跳过加载（日志“模块加载失败 raid.js”），其余功能不受影响。
- **测试参数**：`cfg.raidShift`（毫秒，平移团本时间）、`cfg.raidMinClear` / `cfg.raidMaxDrop`（覆盖防作弊阈值）；环境变量 `DNF_RAID_FAST=1` = 两个都关（给 RA2 的 `?raidfast` 浏览器测试用）。
- 测试：`node --disable-warning=ExperimentalWarning server/test/raid.mjs`（约 5 秒，97 项：两人全流程、单人引导、每周次数、作弊、断线 / 重启恢复、网页版一致性）。
- **客户端（RA2，10-01：`src/net/raid.js` 的 `raidNet` + `src/ui/raid.js`）**
  - 入口：暗黑城阿甘左的服务「团本」（`NPC_SERVICES.raid`，往 `NPCS.agonzo.services` 追加）→ 团本窗口（次数 `GET /api/raid`、建团 / 加入 / 准备 / 开始、练习说明）；门槛 Lv60 + 希洛克主线。营地 v1 就是暗黑城（`RAID_CAMP`），节点打完 / 倒下都回这里并自动打开情况板。
  - 攻坚情况板 `menus.open('raidboard')`（城镇里按 R / 点顶上的团本条）；局内 HUD 画在 UI 画布左上（组队时在队伍血条下面）；阶段结算 `raidres`（领奖后翻牌）。
  - 进节点：`raid:entered` → 单独进 = 本地 `new Dungeon(def)`；一起进 = 队长 `coop.lead(dg, 0, { raid, node, run })`（coop.js 的最小钩子：`lead` 第三个参数进 `room:open` 的 meta；`def.raid` 的地下城不查疲劳）。包装（不改 dungeon.js）：`Dungeon.prototype.start / spawnRoom / bossDown / go / revive / fail`、`save.useFatigue`、`killEnt`、`rollDrop`（练习不掉装备）、`menus.w_result`（节点没有翻牌，按钮“返回营地”）。
  - 领主（`raidNet.bossSetup`）：团本数值（`dg.D`）、`?raidfast` 血量 ×0.05、`hpStart` / 存档点血量、效果用 `msMulSet(b, 'raid_<id>', 受伤倍率)`、破防 = `aiCd`。顺序 / 同步节点的领主打空时先按住（1 血、无敌、不动）报 `down`，按 ack / fx（clear / done / heal / revive）或会话状态（`reconcile`）真的倒下或起来。RA3 的 `raidLink` 接管时，把 `b.raidHold` 关掉、效果改走自己的机制即可。
  - 上报队列：`raidNet.queue`（没回执的 `raid:ev`，重连 `netOpen` 时补发、`localStorage['dawnbreak_raid_<uid>']` 防刷新丢失；刷新后发现自己还挂在节点里 → 报 `fail lost`）。离线（没登录）：本地 `RAID_CORE` 跑引导，会话存 `save.data.raidRun`，次数 `save.data.raidWeek`；领奖入账记 `save.data.raidGot[sid:phase]`（只入账一次），物品还没登记（RA3）先记 `save.data.raidOwed`，登记后回城自动发。
  - 节点地下城：RA3 定义了 `DUNGEONS['raid_si_*']` 就用真的；没有的按 `RAID_FALLBACK_DG`（net/raid.js 顶上）复制现有希洛克地图（不进门、没有原掉落表）。
  - 测试：`node test/raid_ui.mjs`（单人引导在线 + 离线手机版，约 2 分钟）、`node test/mp_raid.mjs`（两人普通全流程：错序 / 跨节点 BUFF / 镜子到 0 / 断线补发 / 双生 / 一起进最终战 / 领奖一次，约 2 分钟）；截图 `test/shots/raid/`。
