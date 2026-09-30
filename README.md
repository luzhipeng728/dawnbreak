<div align="center">

<img src="docs/img/title.webp" width="640" alt="破晓地下城">

# 破晓地下城 · Dawnbreak Dungeon

**一个能在浏览器里直接玩的《地下城与勇士》(DNF) 复刻：横版格斗、刷图、装备、转职、组队、决斗场，Q 版画风。**

不用下载，不用安装，打开网页就能玩；电脑用键盘，手机横屏用触屏按键。

[**在线试玩 → dnf.cc.l-hate.com**](https://dnf.cc.l-hate.com)

</div>

---

> **这个项目是在 Claude Opus 5.5 的一个周额度限制内做出来的，1 天完成。**
> 从玩法、约 500 件装备、三大职业的全部技能，到美术流水线、联机服务端和测试，都由 AI 智能体协作完成；人负责提需求、看效果、定方向。

## 这是什么

《破晓地下城》是一款纯 Web 的横版动作刷图游戏，玩法、键位、技能、装备体系都对着国服 DNF 现版做：

- 方向键 + Z / Space 的**搓招指令**，技能栏、连击、浮空、霸体、抓取、受身蹲伏……都是格斗游戏该有的手感。
- 不是“换皮”：每个职业的技能都逐个对照官方（效果、段数、冷却、机制），并有对照记录，见 [`docs/skills/`](docs/skills)。
- 有完整的世界：城镇、区域地图、地下城、深渊、任务线、NPC、宠物、时装、拍卖行、邮件。
- 单机存档在浏览器里，也可以登录账号，云存档、好友、聊天、组队、决斗场排位。

## 主要内容

| 方面 | 内容 |
|---|---|
| **职业** | 鬼剑士 · 神枪手 · 魔法师（男格斗家开发中），15 个转职，每个转职都有独立的技能树、外观、觉醒（一觉 / 二觉 / 三觉）和觉醒插图 |
| **等级** | 上限 Lv60，区域覆盖艾尔文防线、赫顿玛尔、西海岸、洛兰、格兰之森、天空之城，以及暗精灵、万年雪山、牛头、虫穴、诺斯玛尔 / 根特、海上列车、时空之门、希洛克等 |
| **装备** | 约 520 件史诗、50 件领主神器，官方物品保持官方等级；强化 / 增幅 / 附魔 / 分解 / 合成 / 继承；套装、冷却缩减装备线；163 把重绘武器（巨剑全部是直刃） |
| **副本** | 普通与高难度地下城、领主机制、深渊（深渊柱两轮战，二轮出领主）、悲鸣洞穴等区域房间玩法 |
| **多人** | 城镇同屏、组队闯关（主机权威模型）、决斗场（一局定胜负，4 秒匹配不到真人自动切 AI）、排行榜、查看其他玩家装备 |
| **手机端** | 参照官方手游的扇形技能布局、滑动键、Buff / 状态按钮列 |
| **画面** | 全部 Q 版原创美术，AI 生图流水线 + 逐帧精灵；角色外观按转职区分头发、发色、武器辉光 |

## 快速开始（本地运行）

需要 Node.js ≥ 22.13。

```bash
git clone https://github.com/luzhipeng728/dawnbreak.git
cd dawnbreak
node build.mjs                 # 生成 dist/web/（网页版）和 dist/dawnbreak.html（离线单文件）
npx serve dist/web             # 任意静态服务器都行；或者直接双击打开 dist/dawnbreak.html
```

只想玩单机：打开 `dist/dawnbreak.html` 即可，存档保存在浏览器里。

想要联机（账号 / 云存档 / 好友 / 组队 / 决斗场）：

```bash
cd server && npm install && npm start
```

服务端部署到自己的机器见 [`server/deploy/DEPLOY.md`](server/deploy/DEPLOY.md)。

> 仓库里不含 AI 生图的原始素材（`art/src/` 等，体积很大）；最终素材在 `art/final/`，游戏运行只需要它。

## 操作

| 按键 | 作用 |
|---|---|
| ← → ↑ ↓ | 移动，双击 ← / → 奔跑 |
| **X** | 普通攻击 / 对话 / 拾取 |
| **C** | 跳跃，↓ + C 后跳 |
| **Z** / **Space** | 指令键，方向 + Z 或 Space 放技能（如 ↓→ + Z） |
| **A S D F G H Shift** / **Q W E R T Y V** | 14 格技能栏 |
| **I** 物品 · **M** 个人信息 · **K** 技能 · **L** 任务 · **N** 世界地图 · **P** 决斗场 · **O** 设置 | 窗口 |

完整说明见 [`docs/PLAYER_GUIDE.md`](docs/PLAYER_GUIDE.md)。

## 技术栈与结构

- **纯前端**：原生 JavaScript，无框架、无运行时依赖。`src/ORDER` 列出的文件按顺序拼进同一个全局作用域，`node build.mjs` 打包（美术按分包懒加载，同时输出离线单文件）。
- **联机服务端**：Node.js（`ws`），账号、云存档、好友、聊天、城镇同屏、组队与决斗房间转发，SQLite 存储。
- **测试**：`test/*.mjs`，无头 Chrome 端到端测试；`sh test/quick.sh` 约 5 分钟，`sh test/all.sh` 全量。
- **美术流水线**：`art/tools/` 里的脚本负责生图、抠帧、绑定锚点、生成武器 / 时装 / 图标。

```
src/            游戏源码（engine 引擎 · game 玩法 · content 内容 · ui 界面 · net 联机）
art/final/      最终美术素材（webp）
art/tools/      美术流水线脚本
server/         联机服务端
test/           端到端测试
tools/          部署与运维脚本
docs/           设计与开发文档
```

## 文档

| 文档 | 内容 |
|---|---|
| [`PLAYER_GUIDE.md`](docs/PLAYER_GUIDE.md) | 游玩指南 |
| [`ARCHITECTURE.md`](docs/ARCHITECTURE.md) | 构建、模块划分、调试参数 |
| [`PLAYBOOK.md`](docs/PLAYBOOK.md) | 开发手册、常用命令、踩过的坑 |
| [`COMBAT.md`](docs/COMBAT.md) · [`ANIMATION.md`](docs/ANIMATION.md) | 战斗与动画系统 |
| [`GEAR.md`](docs/GEAR.md) · [`GEAR_PLAN_60.md`](docs/GEAR_PLAN_60.md) | 装备体系 |
| [`PVP.md`](docs/PVP.md) · [`NETWORK.md`](docs/NETWORK.md) | 决斗场与联机 |
| [`MOBILE.md`](docs/MOBILE.md) | 手机端 |
| [`CONTENT_GUIDE.md`](docs/CONTENT_GUIDE.md) | 如何添加内容 |
| [`CLASS_PLAN_FIGHTER.md`](docs/CLASS_PLAN_FIGHTER.md) | 新职业（男格斗家）开发计划 |
| [`docs/skills/`](docs/skills) | 每个职业技能与官方的逐项对照 |

## 路线图

- [x] 三大职业 15 个转职到三觉，等级上限 60
- [x] 装备 2.0、深渊、决斗场、组队联机、手机端
- [ ] **男格斗家**（气功师 / 散打 / 街霸 / 柔道家）：骨架已就绪，技能、美术、任务陆续开放
- [ ] 跑动动画帧重绘、转职插图更新
- [ ] 更多区域与副本

## 关于这个项目是怎么做出来的

- 模型：Claude Opus 5.5；总共用了**一个周额度上限**，**1 天**做完。
- 方式：一个主线程负责拆任务、审图、合并、部署，每个职业 / 每块内容交给独立的子智能体，在各自的 git worktree 里并行开发，各自写测试、对照官方资料、写对照记录。
- 流程沉淀在 [`docs/PLAYBOOK.md`](docs/PLAYBOOK.md)：怎么拆分、怎么验证、踩过哪些坑，想复用这套“AI 团队做游戏”的方法可以直接看。

## 声明

这是一个个人的学习与同人向项目，与 Nexon、Neople、腾讯没有任何关系。《地下城与勇士》及相关名称、设定归其权利人所有；游戏中的美术为原创或 AI 生成，不包含官方素材。
