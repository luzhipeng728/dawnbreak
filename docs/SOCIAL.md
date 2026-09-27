# 社交与经济服务（拍卖行 / 邮件 / 排行榜 / 全服公告 / 每日签到 / 管理员后台 / 公会 / 成就）

负责人：社交与经济服务组（a40ffb4fda66bd8fd）。
这些功能都依赖服务端数据库，并且跨玩家。它们只在**登录后**出现。单机模式（离线单文件、不登录的网页版）完全不受影响：按钮不显示，事件不做任何事。
例外：**成就**是跟随角色存档的通用系统，单机也能用；其中标着“联机”的社交类成就要登录后才能推进，成就点排行要登录。

服务端挂在联机组的模块扩展点上（见协作板“服务端模块扩展点”）。

## 文件
| 位置 | 内容 |
|---|---|
| `server/modules/mail.js` | 邮件：收件箱、领取附件、好友寄信、`send()`（其他模块发系统邮件都走它） |
| `server/modules/auction.js` | 拍卖行：上架、搜索、购买、下架、到期退回、成交价参考 |
| `server/modules/rank.js` | 排行榜：角色数据上报、通关时间、决斗胜场、全部 / 好友榜 |
| `server/modules/notice.js` | 全服公告：校验、生成文案、记录、广播 |
| `server/modules/signin.js` | 每日签到：按服务器时间的月历、连续签到奖励（奖励通过邮件发放，客户端自动领取） |
| `server/modules/gm.js` | 管理员后台：发邮件、邀请码、在线玩家、发公告、日志、强制下架；公共操作日志表 `svc_log`（`ctx.mods.gm.log()`，拍卖 / 邮件 / 签到 / 管理员操作都记在这里） |
| `server/modules/guild.js` | 公会：创建、职位、邀请 / 申请 / 审批、公告与留言板、公会频道（WS）、贡献与等级、公会技能表、公会商店、排行、名牌标签 |
| `src/net/social_guild.js` | 公会客户端：数据缓存、名牌标签 `netPlayerTag`、公会频道（包一层聊天框）、公会技能加属性（包一层 `equipTotals`）、贡献上报、玩家菜单“邀请加入公会”、徽章绘制 |
| `src/content/achievements.js` | 成就定义（149 个）和成就 / 公会称号 |
| `src/game/achieve.js` | 成就规则：事件统计、检查达成、领奖、商城旧成就并入 |
| `src/net/social.js` | 客户端逻辑：接口封装、待办对账（防复制 / 防丢失）、公告上报、排行榜上报、邮件领取入包 |
| `src/ui/social/*.js` | 窗口：`auction` `mail` `rank` `signin` `gm` `guild` `achieve`；顶部滚动公告条；社交按钮条和信封提示；成就达成弹窗 |
| `test/svc_api.mjs` | 接口测试（不开浏览器）：拍卖、邮件、签到、排行榜、公告、管理员，共 89 项 |
| `test/svc_host.mjs` | 测试用服务端：联机组的真实服务端（`server/index.js` 的 `start()`）+ 临时数据库，注册测试账号、加好友，打开 gm 的测试接口（`DNF_SVC_TEST=1`，可以平移服务端时间） |
| `test/svc_guild_api.mjs` | 公会 / 成就点排行接口测试（62 项） |
| `test/svc_guild.mjs` | 公会 + 成就端到端测试（39 项，同时最多 2 个玩家） |
| `test/svc_play.mjs` | 端到端测试（40 项）：本机起服务端（临时数据库），1 个 Chrome 里同时最多 2 个玩家上下文，全部走真实界面 |

窗口名：`auction`（拍卖行）、`mail`（邮件）、`rank`（排行榜）、`signin`（签到）、`gm`（管理员后台）、`guild`（公会）、`achieve`（成就）。
快捷键（都可以在按键设置里改）：拍卖行 `B`、公会 `J`、成就 `U`。
入口：
- 屏幕左侧（任务指引下方）的社交按钮条：签到 / 邮件 / 公会 / 拍卖行 / 排行榜 / 管理。
- 右下角菜单按钮栏：新增“成就”“公会”两个按钮，放在商城那一行上面。
- 系统菜单（Esc）：新增“成就”。

## 数据表（SQLite，时间一律毫秒时间戳）
```sql
-- 邮件
mail(id PK, to_id, from_id, from_name, kind,        -- kind: sys 系统 / gm 管理员 / friend 好友 / auction 拍卖行
     title, body, gold, cera, items TEXT,           -- items: JSON 数组 [{ key, n, opt? } | { item: 完整物品对象 }]
     created, expires,                              -- expires 为 NULL 表示不过期（拍卖行邮件，官方做法）
     read_at, claimed_at, claim_rid, rid, deleted)  -- rid：好友寄信的请求 id（幂等）
-- 拍卖行
auction(id PK, rid UNIQUE,                          -- rid：客户端生成的请求 id（上架幂等）
        seller_id, seller_name, seller_char,
        item TEXT,                                  -- 完整物品对象 JSON
        key, name, kind, cat, slot, rar, lvl, cls, enh, n,   -- 冗余出来给搜索 / 排序用
        price, unit, fee, hours, created, expires,
        status,                                     -- on 在售 / sold 已售 / expired 到期退回 / cancel 已下架
        buyer_id, buyer_name, buy_rid, closed_at)
-- 排行榜
rank_char(user_id, cid, user_name, char_name, cls, job, lvl, exp, score, epics, duel_win, duel_lose, duel_draw, updated,
          PRIMARY KEY(user_id, cid))                -- cid = 角色创建时间 save.data.created
rank_clear(user_id, cid, dungeon, diff, time_ms, at, PRIMARY KEY(user_id, cid, dungeon, diff))
-- 公告
notice(id PK, kind, user_id, user_name, char_name, text, rar, at)
-- 签到
signin(user_id, day, at, reward TEXT, PRIMARY KEY(user_id, day))   -- day = 'YYYY-MM-DD'（北京时间 06:00 换日）
-- 日志
svc_log(id PK, at, type, user_id, user_name, detail TEXT)          -- type: auction.list / auction.buy / auction.expire / auction.cancel / mail.send / mail.claim / signin / gm.*
```
邀请码表 `invites` 由联机组的核心模块建立，管理员后台通过 `ctx.mods.account.createInvite / listInvites / deleteInvite` 使用。

## 接口（HTTP，都需要登录；`gm` 只有管理员能调）
| 接口 | 作用 |
|---|---|
| `GET /api/mail` | 收件箱（最近 100 封，已过期的不返回）+ `unread` |
| `GET /api/mail/unread` | 未读 / 未领取数量 |
| `POST /api/mail/read {id}` | 标为已读 |
| `POST /api/mail/claim {id, rid}` | 领取附件，返回附件；同一个 rid 重复调用返回同样的结果（幂等） |
| `POST /api/mail/send {to, title, body, gold, items, rid}` | 给好友寄信（只能寄给互为好友的人；附件：金币、物品） |
| `DELETE /api/mail/:id` | 删除（有未领取附件的不能删） |
| `GET /api/auction/search?q&cat&slot&rar&lvmin&lvmax&cls&sort&page` | 搜索在售物品，每页 20 条 |
| `GET /api/auction/mine` | 我的在售 + 最近的成交 / 退回记录 |
| `GET /api/auction/price?key=` | 近 7 天成交价参考（均价 / 最低 / 笔数，按单价） |
| `POST /api/auction/list {item, n, price, hours, rid, char}` | 上架（幂等：同一个 rid 只会上架一次） |
| `POST /api/auction/buy {id, rid, char}` | 一口价购买（幂等：同一个 rid 重复调用返回成功） |
| `POST /api/auction/cancel {id}` | 下架，物品通过邮件退回，保管费不退 |
| `GET /api/rank?board&scope&dungeon&diff` | 排行榜。board：`lvl` 等级、`score` 装备评分、`duel` 决斗胜场、`clear` 通关时间、`epic` 史诗收集；scope：`all` / `friends` |
| `POST /api/rank/report {cid, char, cls, job, lvl, exp, score, epics, chars}` | 上报角色数据；`chars` 为账号下现存角色的 cid 列表（删掉的角色自动下榜） |
| `POST /api/rank/clear {cid, dungeon, diff, time}` | 上报通关时间（只保留最快的一次） |
| `POST /api/rank/duel {cid, win, draw}` | 上报好友决斗结果 |
| `POST /api/notice {kind, char, item, lvl, place, job, box, name}` | 上报公告，由服务端生成文案并广播 |
| `GET /api/notice/recent` | 最近 20 条公告 |
| `GET /api/signin` | 本月签到日历、今天是否已签、连续天数、奖励表 |
| `POST /api/signin` | 签到，奖励以系统邮件发出，客户端立即自动领取 |
| `POST /api/gm/mail {to, title, body, gold, cera, items, days}` | 发邮件。`to` 为用户名数组或 `'*'`（全体） |
| `GET /api/gm/online` | 在线玩家 |
| `GET /api/gm/invites` / `POST /api/gm/invite {note, n}` / `DELETE /api/gm/invite/:code` | 邀请码 |
| `POST /api/gm/notice {text}` | 发布全服公告 |
| `GET /api/gm/logs?type&user&limit` | 操作日志（拍卖、邮件、签到、管理员） |
| `GET /api/gm/auction?status` / `POST /api/gm/auction/cancel {id}` | 查看拍卖行、强制下架（物品邮件退回卖家） |

WS（服务端 → 客户端）：`mail:new { unread }`，`notice:show { kind, text, user, char, rar, at }`。客户端不通过 WS 发消息。

## 规则与数值（对齐官方经典版，数值可调）
### 拍卖行
- 只有一口价，没有竞拍。现在的官方拍卖行也是这样。
- 上架时长：12 / 24 / 48 小时。
- 保管费：上架时收取，不退，= max(10, ⌊价格 × 0.5% × 时长系数⌋)，时长系数 12 小时 0.5、24 小时 1、48 小时 2。
- 成交手续费：5%（官方不用优惠券时的费率），卖家通过邮件收到 95%。
- 每个账号同时最多上架 10 件；价格 1 ~ 20 亿 G。
- 可以上架：背包里的物品，身上穿着的不行。可以叠加的物品可以拆分数量上架。
- 不能上架：
  - 任务道具
  - `ITEMS[key].bind` 或实例 `it.bind`（`'account'` / `'char'`，账号绑定 / 角色绑定）
  - `noTrade` / `noSell`
  - 计数型货币（复活币、点券等）
  - 装备深化组提供了 `itemTradable(it)` 时，以它为准。
- 物品交割：
  - 卖家上架时，物品从卖家的存档里移除。
  - 买家付款后，买家的物品和卖家的金币都通过拍卖行邮件到账。这类邮件不过期。
  - 到期没卖出、主动下架、管理员强制下架时，物品邮件退回。
  - 服务端每 30 秒检查一次是否到期，每次搜索前也会检查一次。
- 不能买自己的东西。
- 搜索：
  - 关键字（名称）
  - 类别：武器 / 防具 / 首饰 / 特殊装备 / 称号 / 时装 / 消耗品 / 材料
  - 部位
  - 品级
  - 等级区间
  - 职业：只筛武器，没有职业限制的物品总会显示
  - 排序：单价、总价、等级、品级、剩余时间、最新
- 成交价参考：近 7 天同一个 key 的成交记录，按单价统计。

### 邮件
- 来源：
  - 系统（签到奖励、拍卖行）
  - 管理员
  - 好友（只能寄给互为好友的人）
- 附件：
  - 金币、点券、物品，每封最多 5 件物品。
  - 好友邮件不能附带点券（官方点券不能在玩家之间转移）。
- 过期时间：
  - 系统 / 管理员 / 好友邮件 30 天（管理员可以自己指定天数）。
  - 拍卖行邮件不过期。
  - 过期邮件会被清除。好友邮件里没领取的附件退回寄件人（系统邮件），其他邮件的附件一并消失。
- 邮费：带附件 100 G，纯文字免费。
- 写信：从背包点选或拖入附件，可以叠加的物品先问数量（可以只寄一部分）。
- 领取：
  - 附件领到**当前角色**身上：金币 → `game.gold`，点券 → `addCera(n, '邮件')`（商城组提供），物品 → 背包。
  - 背包空间不够时整封不领，并提示“背包空间不足”。
  - 客户端不认识的物品 key（对方版本更新）时也不领，并提示“请刷新页面更新游戏”。
- 有未读邮件时：
  - 屏幕左侧社交按钮条的信封会闪烁，并显示数量。
  - 新邮件到达时，左下角系统消息提示“收到新邮件”。

### 排行榜
- 按角色上榜，`cid` = 角色创建时间。榜单：
  - 等级：同等级比经验。
  - 装备评分：装备深化组的 `gearScore()`；没有时用兜底公式。
  - 决斗胜场：好友决斗的胜场，同胜场时负场少的在前。
  - 通关时间：每个地下城、每个难度，比最快一次的用时。
  - 史诗收集：装备深化组的 `epicCollectCount()`；没有时统计背包、仓库、身上的史诗种类数。
- 全部玩家榜 / 好友榜（自己 + 互为好友的人）。每页显示前 50 名，另外单独标出自己的名次。
- 上报时机（防抖 5 秒）：
  - 进城
  - 升级
  - 穿脱装备
  - 转职
  - 通关（同时上报通关时间）
  - 决斗结束
  - 切换角色

### 全服公告
- 客户端 `bus.emit('announce', { kind, ... })`。格式见协作板“announce 事件格式”，以协作板那条为准。
- 我兜底监听的事件：
  - 地上捡起史诗（`pickup`）
  - 强化 +10 以上（`enhance`）
  - 转职（`jobChange`）
  - 首次通关城主宫殿 / 悬空城（`dungeonEnter` + `dungeonClear`）
- 同一件物品（`item.id` + kind + lvl）在 10 秒内只上报一次。
- 服务端：
  - 按 kind 白名单生成文案，名字长度有上限。
  - 每个用户 60 秒内最多 20 条。
  - 记入 `notice` 表，广播给所有在线玩家。
- 客户端显示：
  - 屏幕上方居中的官方式滚动公告条（DOM + CSS transform 动画，不占画布绘制）。
  - 多条排队，依次播放。
  - 同时写进左下角系统消息。
- 管理员公告：`kind: 'custom'`，文字原样显示（转义后）。玩家客户端不能发 custom。
- 文案示例：勇士「A」将 [寒光太刀] 强化到了 +12！ / 勇士「A」在天空之城获得了史诗装备 [xx]！（名字里的方括号会被去掉，客户端按品级给 [物品名] 上色）

### 每日签到
- 以服务器时间为准：北京时间 06:00 换日，和游戏里疲劳恢复一致。
- 按月显示签到日历。奖励按“本月第 N 次签到”发放（1 ~ 31），连续签到 3 / 7 / 14 / 21 / 28 天时另有奖励。
- 奖励通过系统邮件发放，客户端签到后立即自动领取。背包满时留在邮箱里，之后再领。
- 奖励物品 key（和商城组约定）：
  - 点券 `cera`（计数型）
  - 魔盒 `box_magic`
  - 抗疲劳秘药 `fatigue`
  - 复活币 `coin`
  - 装备强化券 `tk_enh7`
  - 装备礼盒 `box_equip`
  - 宝珠礼盒 `box_orb`
  - 消耗品礼盒 `box_supply`
  - 装备强化保护券 `guard`
  - 无色小晶块 `crystal`
- 奖励表写在 `server/modules/signin.js`，客户端只负责显示。

### 管理员后台（`net.user.admin` 为真才出现）
- 给玩家发放金币 / 点券 / 物品：以邮件形式发出。
  - 物品从物品库里搜索 key 选择，可以设置数量、强化等级、品级。
  - 收件人可以是一个或多个用户名，也可以是全体玩家。
- 生成 / 查看 / 删除邀请码。
- 查看在线玩家（场景、角色、等级）。
- 发布全服公告。
- 查看日志：拍卖行（上架、成交、退回）、邮件（发送、领取）、签到、管理员操作。
- 查看拍卖行全部挂单，并可以强制下架。

## 公会
### 数据表
```sql
guild(id PK, name UNIQUE NOCASE, badge JSON{s 形状, c 颜色, g 字}, leader_id, notice, intro, lvl, exp, join_mode 'apply'|'open'|'closed', rid, created)
guild_member(user_id PK, guild_id, role 'leader'|'vice'|'member', joined, contrib 可用贡献, contrib_total 累计贡献, char_name/char_cls/char_lvl 最后的角色, last_on)
guild_req(guild_id, user_id, kind 'apply'|'invite', by_id, msg, created)      -- 申请 / 邀请
guild_post(id PK, guild_id, user_id, user_name, char_name, text, created, sys)  -- 留言板（sys = 公会动态：创建、加入、离开、升级……）
guild_contrib(user_id, day, kind, n)                                            -- 每日贡献次数（上限用）
guild_buy(user_id, rid, shop_id, cost, week, at)                                -- 公会商店兑换记录（按 rid 幂等、周限购）
```
### 接口
| 接口 | 作用 |
|---|---|
| `GET /api/guild` | 我的公会（概况、成员及在线状态 / 位置、留言、申请、商店、公会技能表、今日贡献）；没有公会时返回收到的邀请 |
| `GET /api/guild/list?q=` / `GET /api/guild/rank` / `GET /api/guild/tags` | 公会列表 / 公会排行 / 名牌标签（用户 id → 公会名） |
| `POST /api/guild/create {name, badge, rid}` | 创建（金币在客户端扣，待办 op gcreate，按 rid 幂等；重名等失败退还金币） |
| `POST /api/guild/apply` / `cancelApply` / `invite` / `accept` / `decline` / `approve` | 申请 / 取消 / 邀请 / 接受 / 拒绝 / 审批 |
| `POST /api/guild/kick` / `role` / `transfer` / `leave` / `disband` | 请离 / 任命副会长 / 转让会长 / 离开 / 解散（输入公会名确认） |
| `POST /api/guild/notice` / `set` / `post`，`DELETE /api/guild/post/:id` | 公告 / 设置（介绍、加入方式、徽章）/ 留言 |
| `POST /api/guild/contrib {kind}` | 贡献：`clear` 通关 / `abyss` 深渊 / `coop` 组队通关（签到由 signin 模块在服务端直接加） |
| `POST /api/guild/shop/buy {id, rid}` | 公会商店兑换：服务端扣贡献、返回物品，客户端入包（待办 op gshop，和领取邮件附件同一套对账） |
WS：`guild:say {text}`（客户端 → 服务端）；`chat {ch:'guild'}`、`guild:update {why}`、`guild:tags`、`guild:invite {id, guild, from}`（服务端 → 客户端）。
### 规则与数值
- 创建：Lv.10 以上，50,000 G。公会名 2~8 个字，不能重名，不能改；徽章 = 8 种形状 × 10 种颜色 × 1 个字，会长以后可以换。
- 职位：会长 1 人；副会长 2 人（公会 Lv.5 起 3 人）；其余是成员。
  - 会长 / 副会长：邀请、审批、改公告和设置、删留言、请离成员。副会长不能请离副会长和会长。
  - 只有会长能任命副会长、转让会长、改徽章、解散公会。
  - 会长要先转让才能离开；如果只剩自己，离开就等于解散。
  - 离开公会后，个人贡献清零（官方做法）。
- 人数上限：10 + (公会等级 - 1) × 2，Lv.10 为 28 人。加入方式分“需要审批 / 自由加入 / 暂停招人”。
- 贡献（公会经验和个人贡献同时增加，按北京时间 06:00 换日）：

  | 来源 | 每次 | 每天上限 |
  |---|---|---|
  | 通关地下城 | +10 | 20 次 |
  | 深渊派对 | +40 | 5 次 |
  | 组队通关 | 额外 +5 | 20 次 |
  | 每日签到 | +30 | 1 次 |

  一个活跃成员每天最多 +430。
- 公会等级：升级所需的累计经验为 1000 / 2500 / 4500 / 7000 / 10000 / 14000 / 19000 / 25000 / 32000，满级 Lv.10。升级时发公会频道消息和全服公告。
- 公会技能（按公会等级自动生效，只在登录且有公会时生效，包一层 `equipTotals` 计入面板）：

  | 公会等级 | 效果 |
  |---|---|
  | Lv.2 | 四维 +5 |
  | Lv.3 | 经验 +3% |
  | Lv.4 | HP / MP +2% |
  | Lv.5 | 金币 +3% |
  | Lv.6 | 四维再 +5 |
  | Lv.7 | 所有属性强化 +5 |
  | Lv.8 | 经验再 +2% |
  | Lv.9 | 移速 +2% |
  | Lv.10 | 四维再 +5、所有属性抗性 +5 |

  满级合计：四维 +15、经验 +5%、金币 +3%。
- 公会商店（个人贡献兑换，周一 06:00 刷新限购）：

  | 物品 | 贡献 | 公会等级 | 限购 |
  |---|---|---|---|
  | 无色小晶块 ×100 | 30 | Lv.1 | 不限 |
  | 复活币 | 40 | Lv.1 | 每周 10 |
  | 抗疲劳秘药 | 60 | Lv.1 | 每周 7 |
  | 强化保护券 | 150 | Lv.2 | 每周 3 |
  | 上级元素结晶 ×5 | 80 | Lv.3 | 每周 5 |
  | 深渊派对邀请函 | 120 | Lv.3 | 每周 5 |
  | 魔盒 | 250 | Lv.4 | 每周 3 |
  | 称号「公会的荣耀」 | 1500 | Lv.5 | 限 1 次 |
  | 增幅保护券 | 400 | Lv.6 | 每周 1 |
  | +7 强化券 | 800 | Lv.7 | 每周 1 |
  | 称号「公会的传奇」 | 4000 | Lv.9 | 限 1 次 |
- 界面：公会窗口（J）分“概况 / 成员 / 留言板 / 公会商店 / 公会排行”5 页。
  - 成员页显示在线状态和所在城镇，可以一键组队（`netPartyInvite`）、私聊。
  - 聊天框里按 Tab 可以切到“公会”频道，也可以用 `/g 内容` 直接发。
  - 城镇里其他玩家的名牌第二行显示「<公会名> 职业」（联机组的扩展点 `netPlayerTag`）。
  - 点其他玩家弹出的菜单里，会长和副会长多一个“邀请加入公会”。
  - 排行榜窗口新增“公会”页签。

## 成就
- 规模：149 个成就（天帷巨兽合并后会自动多出 6 个讨伐和 1 个区域成就）。
  - 按分类：成长 26、战斗 40、收集 23、社交 21、经济 24、探索 15。
  - 按档位：铜 63、银 55、金 31。
  - 成就点：铜 10 / 银 25 / 金 50，合计 3,555。
- 数据跟随角色存档（云同步）：`save.data.ach = { c: 统计计数, done: { id: 达成时间 }, got: { id: 领奖时间 } }`。
  - 统计来自事件总线：kill / dungeonClear / enhance / amplify / forge / enchant / boxOpen / skySynth / cashBuy / pvpResult / questDone / npcTalk …，再加上本组的 sxAuction / sxMail / sxChat / sxSignin / guildUpdate / friendsList。
  - 状态类的数据直接读：等级、转职 / 觉醒、任务、图鉴、背包和仓库里的称号 / 时装 / 宠物、去过的地方、通关记录。
- 达成时机：
  - 有相关事件时，最多每 0.4 秒检查一次。
  - 进入角色后先静默检查一次：老存档里已经满足条件的直接算达成，不弹窗。
- 达成表现：
  - 屏幕下方（技能栏上面）弹出成就提示，同时最多 2 条，其余排队；播放音效，金色成就用史诗音效。
  - 左下角系统消息记一笔。
  - 金色成就会发全服公告（announce kind `ach`）。
- 奖励（在成就窗口里点“领取”或“一键领取”）：
  - 点券：调用商城组的 `addCera`。
  - 称号：11 个成就称号，角色绑定，属性克制。
  - 道具：魔盒、+7 强化券、保护券、疲劳药、复活币。
  - 背包空间不够时不能领取，先提示。
  - 有没领的奖励时，“成就”菜单按钮上亮红点。
- 并入商城组的 CASH_ACH（14 个，id、条件、点券都不变）：
  - 读档时如果 `save.data.shop.ach[id]` 已有值，直接算已达成、已领奖。
  - 本系统达成时也写 `save.data.shop.ach[id]`。
  - 商城组在事件回调里判断 `typeof ACHIEVEMENTS`，存在时不再自己发奖。
  - 这样不管哪边先合并，都不会重复发点券（测试里验证过）。
- 点券总量 32,330（其中 CASH_ACH 11,500）。认真玩的第一周约 3,590，之后每周约 3,500 且逐周减少，已发给商城组计入经济模拟。
- 成就点进排行榜：`rank_char.ach` 列，排行榜窗口新增“成就点”页签。
- 窗口（U / 菜单按钮“成就” / 系统菜单）：
  - 总览页：成就点、各档完成数、各分类进度、最近达成、一键领取。
  - 6 个分类页签：进度条、奖励、领取按钮，可以按“全部 / 未完成 / 已完成”筛选。
  - 隐藏成就在达成前只显示“？？？”；需要登录才能推进的标着“联机”。

## 关键流程：防复制 / 防丢失（请求 id + 待办对账）
玩家的金币和背包在**自己的云存档**里，由客户端写。拍卖行、邮件在**服务端数据表**里。两边之间没有分布式事务，所以用下面的做法：
1. 在**本地存档**里先完成扣减（上架的物品、购买用的金币、寄信的附件），同时在当前角色存档的 `save.data.svcPend` 里记一条待办 `{ rid, op, ... }`，然后 `save.write()`，并立即上传云存档（联机组提供的立即上传函数）。
2. 调服务端接口，接口按 `rid` 幂等。
3. 根据结果处理：
   - 成功：删掉待办。
   - 服务端明确拒绝（4xx，例如“已被别人买走”）：把扣掉的东西还回去，删掉待办。
   - 网络错误：保留待办。下次进城 / 登录时，用同一个 `rid` 重新调用（对账），结果按上面两种情况处理。
4. 领取附件时，先在待办里记 `{ op: 'claim', id, rid }` 再请求。服务端按 `claim_rid` 幂等返回附件，客户端入包后删掉待办。这些改动在同一次写存档里完成。

这样做以后，无论在哪一步断网或刷新，物品和金币都不会复制，也不会丢失。

## 与其他组的约定（都已对上，且都有 typeof 兜底：对方的代码没合进来时也能运行）
- 联机：
  - 服务端：模块扩展点（`routes / migrations / init / tick`）、`ctx.sendTo / broadcast / online / findUser`、`ctx.mods.social.friendsOf`、`ctx.mods.account.createInvite / listInvites / deleteInvite`。
  - 客户端：`net.api / net.on`、`netLogin / netOpen / netLogout` 事件、`netSaveFlush()`（立即上传云存档）。
  - 好友决斗结束时的 `pvpResult { win, draw, vs }` 由联机组在 M4 发出。
- 商城：
  - 点券：`addCera(n, 来源)`，余额在 `save.data.cera`。
  - 计数型物品：`cera` / `shard_box` / `coin_gift`，不占格子。
  - 签到奖励的物品 key：`box_magic` `box_supply` `box_equip` `box_orb` `tk_enh7`。
  - 公告：`skyset` / `box` / `multi`。
- 装备深化：
  - 交易与绑定：`itemTradable(it)` / `itemBindText(it)`，绑定取值 `'char' | 'account' | 'equip'`（封装：穿戴后变为账号绑定）。
  - 排行榜数据：`gearScore(inv.equip)`、`epicCollectCount()`。
  - 公告：`amplify` / `epic`（翻牌带 `via: 'card'`）。
  - 这些都已在试合并里验证过：史诗默认“封装”可以上架，穿过以后不行；时装账号绑定，不能上架；邮件附件里的点券 / 魔盒 / 强化券能正常领取。
- 世界：诺顿（赫顿玛尔中央广场）的 services 里有 `auction`、`mail`（提交 610f2c0），由 `ui/social/common.js` 用 `NPC_SERVICES.xxx ??=` 注册。
- 联机（公会）：名牌扩展点 `netPlayerTag(userId)`（town.js，da8fb8f）；聊天框的 `CHAT_CH` / `chat.cycle` / `chat.sendText` 和玩家菜单 `menus.w_pmenu` 在我的文件里包一层（联机组已确认）；组队邀请直接调 `netPartyInvite`。
- 商城（成就）：`typeof ACHIEVEMENTS` 兜底开关（f102382），经济模拟并入成就点券（5d0aceb）。
