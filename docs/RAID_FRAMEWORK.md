# 团本框架：新增一个团本的流程

规则核心 `src/game/raid_core.js`（浏览器与服务端 vm 共用同一个文件，纯逻辑）。内容通过 `RAID_DEFS.<id>` 注册。

## 1. 档位与人数

| 档位 | 触发 | 说明 |
|---|---|---|
| guide | 单人引导 | 1 队 |
| duo | 默认建团 | 两人，行为和旧版完全一致 |
| team | 建团时 `team:true` 且 def.maxPlayers > duoMax | 多队，上限取自 def |

def 字段：`duoMax`(默认2)、`teamSize`、`minPlayers`、`minTeams`(默认2)、`maxTeams`、`maxPlayers`、`blurb`、`reqQuest`、`reqName`。
规则参数随队数缩放：scale 表字段、`D.lives`、`D.limits` 可写成函数 `(nt,S)=>值`；`D.par(nt)` 缩放阶段时限。代码里不要硬编码团本名或 ×2/×0.5。
队长用 `team` 事件分队（不分则按 party 分组再均衡）、`mark` 事件指定目标（可带 `team`）。`S.teams=[{id,members:[uid]}]`，成员带 `m.team`。

## 2. 节点类型与效果

通用：`func`（全团增益）、`key`/`needKey`（钥匙开门）、`fx` 种类 `gbuff/key/unlock/lock/countdown/sanity/chaos`；`fx.clear` 对任意节点类型生效。
理智/混沌：def.sanity `{max,restore}`、def.chaos `{max,cur:[…]}`；混沌会乘奖励货币。客户端事件走 bus：`raidGbuff/raidKey/raidChaos/raidSanity`。

## 3. 精英（`src/game/raid_elite.js`）
`defineRaidElite(id, spec)`，破防条件：elemBall / intercept / killClone / breakShell / eyeGuard / counterBreak，数据驱动；击杀可触发全局效果。副本房间类型 `'elite'`，房间 spec 填 `eliteSpec`；节点 `elites:{id:{fx,once,text}}`，服务端事件 `elite`（只有房主上报）。专属技能 = 在地区 spec 里定义 `tier:'elite'` 的怪并让房间 `elite:` 指向它。

## 4. 新增步骤
1. 新建 `src/game/raid_<id>.js`，注册 `RAID_DEFS.<id>`（参考 `raid_ozma.js`），加进 `src/ORDER`（在 raid_core 之后）。
2. 服务端 `loadRaidCore`（server/modules/raid.js）的定义包列表加入文件名；`tools/deploy.sh` 的 rsync 同步到 `lib/`。
3. `content/raids` 副本：`raid:true`，dg id 与 def 的 `dg` 对应。
4. UI：`src/ui/raid.js` 的 `RAID_AREA` 加区域名；`blurb` 用于入口卡片。
5. 测试：用 vm 单独加载 raid_core 做规则测试，并加入 `test/affected.mjs`。

## 5. 联机消息
`raid:create {team}`、`raid:team {uid,team}`、`raid:invite {uid}`、`raid:mark {team}`；客户端 `raidNet.tier/teams/teamOf/markTeam/setTeam/invite/eliteKill/sanity`。

## 6. 已知限制
- 一队 = 一个 party（房间上限 4）；`together` 节点按队判定，不支持跨 party 同房。
- 4~5 人会自动拆成 ≥2 队（`minTeams`）。
- ozma 的 def 是骨架，奖励为占位；`ozma_core.js` 独立状态机仅保留给自己的测试。
- 精英运行时（刷物件/HUD）只在房主端，未做浏览器测试；访客端精英视觉未镜像。
