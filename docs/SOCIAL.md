# 社交与经济服务（拍卖行 / 邮件 / 排行榜 / 全服公告 / 每日签到 / 管理员后台）

负责人：社交与经济服务组（a40ffb4fda66bd8fd）。
这些功能都依赖服务端数据库，并且跨玩家。它们只在**登录后**出现。单机模式（离线单文件、不登录的网页版）完全不受影响：按钮不显示，事件不做任何事。

服务端挂在联机组的模块扩展点上（见协作板“服务端模块扩展点”）。

## 文件
| 位置 | 内容 |
|---|---|
| `server/modules/mail.js` | 邮件：收件箱、领取附件、好友寄信、`send()`（其他模块发系统邮件都走它） |
| `server/modules/auction.js` | 拍卖行：上架、搜索、购买、下架、到期退回、成交价参考 |
| `server/modules/rank.js` | 排行榜：角色数据上报、通关时间、决斗胜场、全部 / 好友榜 |
| `server/modules/notice.js` | 全服公告：校验、生成文案、记录、广播 |
| `server/modules/signin.js` | 每日签到：按服务器时间的月历、连续签到奖励（奖励通过邮件发放，客户端自动领取） |
| `server/modules/gm.js` | 管理员后台：发邮件、邀请码、在线玩家、发公告、日志、强制下架 |
| `server/modules/svclog.js` | 公共操作日志表 `svc_log`（拍卖 / 邮件 / 签到 / 管理员操作），供后台查询 |
| `src/net/social.js` | 客户端逻辑：接口封装、待办对账（防复制 / 防丢失）、公告上报、排行榜上报、邮件领取入包 |
| `src/ui/social/*.js` | 窗口：`auction` `mail` `rank` `signin` `gm`；顶部滚动公告条；社交按钮条和信封提示 |
| `test/svc_*.mjs` | 自动测试：本机临时数据库起服务端，2 个无头浏览器模拟两个玩家 |

窗口名：`auction`（拍卖行）、`mail`（邮件）、`rank`（排行榜）、`signin`（签到）、`gm`（管理员后台）。
快捷键：拍卖行 `B`（可以在按键设置里改）；其他窗口从右侧的社交按钮条打开。

## 数据表（SQLite，时间一律毫秒时间戳）
```sql
-- 邮件
mail(id PK, to_id, from_id, from_name, kind,        -- kind: sys 系统 / gm 管理员 / friend 好友 / auction 拍卖行
     title, body, gold, cera, items TEXT,           -- items: JSON 数组 [{ key, n, opt? } | { item: 完整物品对象 }]
     created, expires,                              -- expires 为 NULL 表示不过期（拍卖行邮件，官方做法）
     read_at, claimed_at, claim_rid, deleted)
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
  - 过期邮件（包括其中未领取的附件）会被清除。
- 邮费：带附件 100 G，纯文字免费。
- 领取：
  - 附件领到**当前角色**身上：金币 → `game.gold`，点券 → `addCera(n, '邮件')`（商城组提供），物品 → 背包。
  - 背包空间不够时整封不领，并提示“背包空间不足”。
  - 客户端不认识的物品 key（对方版本更新）时也不领，并提示“请刷新页面更新游戏”。
- 有未读邮件时：
  - 右侧社交按钮条的信封会闪烁，并显示数量。
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
  - 每个用户 60 秒内最多 10 条。
  - 记入 `notice` 表，广播给所有在线玩家。
- 客户端显示：
  - 屏幕上方居中的官方式滚动公告条（DOM + CSS transform 动画，不占画布绘制）。
  - 多条排队，依次播放。
  - 同时写进左下角系统消息。
- 管理员公告：`kind: 'custom'`，文字原样显示（转义后）。

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

## 与其他组的约定
- 联机：模块扩展点、`net.api / net.on`、`netLogin / netLogout` 事件、好友列表、在线列表、立即上传云存档、`pvpResult` 事件。
- 商城：点券 `save.data.cera` / `addCera(n, 来源)`；签到奖励的物品 key；魔盒大奖、天空套合成的公告。
- 装备深化：`bind` 字段 / `itemTradable(it)`；`gearScore()`；`epicCollectCount()`；增幅、史诗掉落的公告。
- 世界：拍卖行 NPC（功能 `auction`，在我的文件里写 `NPC_SERVICES.auction ??= {...}`）。
