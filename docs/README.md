# 文档索引

按"你要做什么"找文档。**现行**＝描述现在的代码怎么工作，改代码时要同步维护；**过程记录**＝某次任务的规划、审计或交接，写完后一般不再更新，当历史背景看，以代码和现行文档为准。

脚本怎么找：[`SCRIPTS.md`](SCRIPTS.md)（所有构建 / 测试 / 美术 / 运维脚本，按用途分类，自动生成）。

## 1. 先读这几份（上手）

| 文档 | 状态 | 内容 |
|---|---|---|
| [`../README.md`](../README.md) | 现行 | 项目介绍、快速开始、架构图、测试与部署命令、"想加点东西"对照表 |
| [`../CLAUDE.md`](../CLAUDE.md) | 现行 | 给 AI 助手和新同事的项目地图：目录、常用命令、必须遵守的约定 |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | 现行 | 构建方式、模块划分、全局作用域约定、调试参数 |
| [`PLAYBOOK.md`](PLAYBOOK.md) | 现行 | 做事手册：常用命令、新增各类内容的步骤、踩过的坑 |
| [`PLAYER_GUIDE.md`](PLAYER_GUIDE.md) | 现行 | 游玩指南（键位、玩法） |

## 2. 战斗、职业与技能

| 文档 | 状态 | 内容 |
|---|---|---|
| [`COMBAT.md`](COMBAT.md) | 现行 | 战斗机制、新增技能 / 转职 / 动作帧的方法 |
| [`COMBAT_JUGGLE.md`](COMBAT_JUGGLE.md) | 现行 | 浮空、倒地、受身（刷图与决斗共用）；刷图一级 / 二级保护、打地 / 扣地规则（§5） |
| [`ANIMATION.md`](ANIMATION.md) | 现行 | 动作手感（跑动 / 攻击）的调整依据 |
| [`JOB_VISUALS.md`](JOB_VISUALS.md) | 现行 | 转职外观：常驻外观与状态特效（运行时覆盖层） |
| [`PVP.md`](PVP.md) | 现行 | 决斗场平衡：公正决斗、伤害修正、职业修正 |
| [`dnf_reference.md`](dnf_reference.md) | 参考 | DNF 玩法机制参考（只描述机制，名称与美术须原创） |
| [`skills/`](skills) | 现行 | 每个职业 / 转职的官方技能规格（`<职业>.json` 供 `skillaudit --compare` 对比，`*_final.md` 为逐项对照） |
| [`SKILLS_OFFICIAL_*.md`](SKILLS_OFFICIAL_common.md) · [`SKILL_ALIGN_FINAL.md`](SKILL_ALIGN_FINAL.md) | 过程记录 | 各职业技能对齐官方的调研与要求（common / sword / gun / mage / fighter / priest） |
| [`CLASS_PLAN_FIGHTER.md`](CLASS_PLAN_FIGHTER.md) · [`CLASS_PLAN_PRIEST.md`](CLASS_PLAN_PRIEST.md) | 过程记录 | 新增一个职业的完整做法：接入点、任务拆分、美术（格斗家是范例） |
| [`FIGHTER_ART_SAMPLES.md`](FIGHTER_ART_SAMPLES.md) · [`PRIEST_ART.md`](PRIEST_ART.md) · [`FIGHTER_GEAR_AUDIT.md`](FIGHTER_GEAR_AUDIT.md) | 过程记录 | 格斗家 / 圣职者的原装美术与装备审计 |
| [`HANDOFF_PRIEST.md`](HANDOFF_PRIEST.md) | 已作废 | 文件内已声明作废，以 `CLASS_PLAN_PRIEST.md` 为准 |

## 3. 装备、商城与经济

| 文档 | 状态 | 内容 |
|---|---|---|
| [`GEAR.md`](GEAR.md) | 现行 | 装备深化：增幅、锻造、附魔、套装、图鉴 |
| [`GEAR_PLAN_60.md`](GEAR_PLAN_60.md) | 过程记录 | 装备 2.0 蓝图（满级 60） |
| [`SHOP.md`](SHOP.md) | 现行 | 商城与礼包设计 |
| [`SOCIAL.md`](SOCIAL.md) | 现行 | 社交与经济服务：拍卖行、邮件、排行榜、公告、签到、后台、公会、成就 |

## 4. 世界、区域与领主

| 文档 | 状态 | 内容 |
|---|---|---|
| [`CONTENT_GUIDE.md`](CONTENT_GUIDE.md) | 现行 | 新增城镇、场景、NPC、地下城门 |
| [`REGION_PIPELINE.md`](REGION_PIPELINE.md) | 现行 | 区域生产线：写 spec → 跑美术命令 → 跑测试 → 审图 |
| [`BOSS_SPEC.md`](BOSS_SPEC.md) | 现行 | 领主 spec 写法与原语速查 |
| [`BOSS_PLAN.md`](BOSS_PLAN.md) · [`boss_inventory.json`](boss_inventory.json) | 过程记录 | 领主差异化规划与盘点数据（`tools/boss_inventory.mjs` 生成） |
| [`RAID_PLAN.md`](RAID_PLAN.md) | 过程记录 | 团本规划（文件内标明了已接入与待实现的部分） |
| [`RAID_SIROCO.md`](RAID_SIROCO.md) | 现行 | 团本 · 无形之希洛克：官方规则对照、两人版取舍、分歧项与来源、实现进度（P0~P4） |
| [`RAID_ANTON.md`](RAID_ANTON.md) | 现行 | 团本 · 安徒恩攻坚战（Neo 版）：流程、精英对应、来源 / 存疑 / 原创标注、奖励 |
| [`RAID_OZMA.md`](RAID_OZMA.md) | 现行 | 团本 · 奥兹玛攻坚战：节点图（三区域 / 功能图 / 倒计时 / 锁血）、理智与混沌、精英与领主机制、融合装备，来源 / 存疑 / 原创标注 |
| [`HANDOFF_RAID_REDESIGN.md`](HANDOFF_RAID_REDESIGN.md) | 交接 | 团本重设计（多队 / 精英 / 安徒恩 / 奥兹玛）进度、未完成项（美术、部署、线上验证）与下一步 |
| [`RAID_FRAMEWORK.md`](RAID_FRAMEWORK.md) | 现行 | 团本框架：多队模型、精英原语、通用机制、新增团本的注册流程 |
| [`REGION_HANDOFF.md`](REGION_HANDOFF.md) | 过程记录 | 海上列车 / 时空之门区域交接（已完成） |

## 5. 美术

| 文档 | 状态 | 内容 |
|---|---|---|
| [`ART_PIPELINE.md`](ART_PIPELINE.md) | 现行 | AI 美术流水线（gpt-image）：提示词模板、每个工具的命令、踩过的坑 |
| [`ASSET_AUDIT.md`](ASSET_AUDIT.md) | 过程记录 | 素材盘点与瘦身（`tools/asset_audit.mjs`） |
| [`img/`](img) | — | README 与文档用到的配图 |

## 6. 联机、性能与终端

| 文档 | 状态 | 内容 |
|---|---|---|
| [`NETWORK.md`](NETWORK.md) | 现行 | 联机设计：账号、云存档、同屏、组队、PK |
| [`PERF.md`](PERF.md) | 现行 | 性能与卡顿排查（帧率 / 网络 / 服务端） |
| [`MOBILE.md`](MOBILE.md) | 现行 | 手机触屏操作 |
| [`../server/deploy/DEPLOY.md`](../server/deploy/DEPLOY.md) | 现行 | 服务端部署（systemd、反向代理） |

## 写文档的约定

- 新增系统或流程：在上表对应分类加一行，并写明状态（现行 / 过程记录）。
- 过程记录类文档开头写日期；被取代时在开头加一句"已被 X 取代"，不要删。
- 新增脚本：文件最前面写一行说明，然后 `node tools/gen_scripts_index.mjs` 更新 [`SCRIPTS.md`](SCRIPTS.md)。
