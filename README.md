<div align="center">

<img src="docs/img/title.webp" width="640" alt="破晓地下城">

# 破晓地下城 · Dawnbreak Dungeon

**一个在浏览器里直接玩的《地下城与勇士》(DNF) 复刻：横版格斗、刷图、装备、转职、觉醒、组队、决斗场，Q 版画风。**

[![在线试玩](https://img.shields.io/badge/play-online-e0a83a?style=flat-square)](https://dnf.cc.l-hate.com)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-2ea44f?style=flat-square)](https://github.com/luzhipeng728/dawnbreak/pulls)
![vanilla JS](https://img.shields.io/badge/vanilla-JavaScript-f7df1e?style=flat-square&logo=javascript&logoColor=black)
![no framework](https://img.shields.io/badge/framework-none-555?style=flat-square)
![Node](https://img.shields.io/badge/Node.js-%E2%89%A5%2022.13-339933?style=flat-square&logo=node.js&logoColor=white)
![art](https://img.shields.io/badge/art-gpt--image-8a5cf6?style=flat-square)
![built with](https://img.shields.io/badge/built%20with-Claude%20Opus%205.5-d97757?style=flat-square)
![platform](https://img.shields.io/badge/PC%20%2B%20mobile-browser-2b7de9?style=flat-square)

不用下载，不用安装，打开网页就能玩。电脑用键盘，手机横屏用触屏按键。

### [在线试玩 → dnf.cc.l-hate.com](https://dnf.cc.l-hate.com)

注册只要**用户名 + 密码**，不需要邀请码；也可以不注册，直接单机玩（存档在浏览器里）。

<img src="docs/img/shots/13_elemental.webp" width="860" alt="元素师三觉：宇宙寂灭·冰火之歌">

</div>

---

> **这个项目是在 Claude Opus 5.5 的一个周额度限制内做出来的，1 天完成。**
> 从玩法、约 500 件装备、三大职业的全部技能，到美术流水线、联机服务端和测试，都由 AI 智能体协作完成；人负责提需求、看效果、定方向。

## 欢迎一起维护：你的 PR 可能明天就会上线

这个游戏欢迎所有人共同维护。无论是修一个 bug、调整手感，还是增加职业、技能、副本、装备、美术、界面、测试或文档，都请大胆提交 PR。**不用担心改动太小，也不需要先等维护者分配任务**；只要它能让游戏变得更好，就值得提交。

每个 PR 都会进入我们的本地自动审核流程，包括构建、相关测试、代码检查和实际试玩。发现问题时，我们会在 PR 里给出具体反馈并一起把它完善；通过审核后由维护者合并和部署。状态合适的改动，**最快第二天就可能出现在[在线版](https://dnf.cc.l-hate.com)**。

参与很简单：

1. Fork 仓库，新建分支并完成你的改动。
2. 至少运行 `node build.mjs` 和与改动相关的测试；不确定该跑什么，可以直接在 PR 里说明。
3. 提交 PR，写清楚解决了什么、怎么验证；如果还没完全做完，也欢迎先开 Draft PR 一起讨论。

### [查看或提交 Pull Request →](https://github.com/luzhipeng728/dawnbreak/pulls)

## 目录

- [欢迎一起维护](#欢迎一起维护你的-pr-可能明天就会上线)
- [截图](#截图)
- [特色](#特色)
- [快速开始](#快速开始本地运行)
- [操作](#操作)
- [架构](#架构)
- [开发指南](#开发指南)
- [美术是怎么做出来的](#美术是怎么做出来的)
- [这个项目是怎么做出来的](#这个项目是怎么做出来的)
- [路线图与参与](#路线图与参与)

## 截图

以下都是游戏里的实际画面（1280×720 和手机横屏 844×390），全部美术由 AI 生成。

### 角色与城镇

<table>
<tr>
<td><img src="docs/img/shots/01_title.webp" width="270"><br><sub>标题画面：登录 / 注册 / 不登录直接玩</sub></td>
<td><img src="docs/img/shots/02_create.webp" width="270"><br><sub>创建角色：鬼剑士 · 神枪手 · 魔法师</sub></td>
<td><img src="docs/img/shots/03_charselect.webp" width="270"><br><sub>选择角色：6 个角色位，时装和武器外观实时显示</sub></td>
</tr>
<tr>
<td><img src="docs/img/shots/04_town_elvenguard.webp" width="270"><br><sub>艾尔文防线：狂战士 + 天空套 + 宠物 + 光环</sub></td>
<td><img src="docs/img/shots/05_town_westcoast.webp" width="270"><br><sub>西海岸：枪炮师夏日时装 + 小海豹</sub></td>
<td><img src="docs/img/shots/06_town_hendon.webp" width="270"><br><sub>赫顿玛尔中央广场：NPC、路人、其他玩家</sub></td>
</tr>
<tr>
<td><img src="docs/img/shots/07_job_advance.webp" width="270"><br><sub>转职：神枪手的 5 个方向，各有立绘</sub></td>
<td><img src="docs/img/shots/08_awakening_cutin.webp" width="270"><br><sub>觉醒插图：每个转职一觉 / 二觉 / 三觉各一张</sub></td>
<td><img src="docs/img/shots/24_worldmap.webp" width="270"><br><sub>世界地图（N）：Lv1~60 连成一条主线</sub></td>
</tr>
</table>

### 战斗：15 个转职，三次觉醒

<table>
<tr>
<td><img src="docs/img/shots/09_berserker.webp" width="270"><br><sub>狂战士三觉 · 血魔极道：灭世</sub></td>
<td><img src="docs/img/shots/10_blade_master.webp" width="270"><br><sub>剑魂三觉 · 万剑极诣·开天斩</sub></td>
<td><img src="docs/img/shots/11_ranger.webp" width="270"><br><sub>漫游枪手三觉 · 盛放·绯红花园</sub></td>
</tr>
<tr>
<td><img src="docs/img/shots/12_launcher.webp" width="270"><br><sub>枪炮师三觉 · 制胜·最终兵器</sub></td>
<td><img src="docs/img/shots/13_elemental.webp" width="270"><br><sub>元素师三觉 · 宇宙寂灭：冰火之歌</sub></td>
<td><img src="docs/img/shots/14_witch.webp" width="270"><br><sub>小魔女三觉 · 糖果大作战：精怪乐园</sub></td>
</tr>
</table>

### 领主、深渊、组队、决斗场

<table>
<tr>
<td><img src="docs/img/shots/15_boss_skasa.webp" width="270"><br><sub>领主战：万年雪山 · 斯卡萨之巢</sub></td>
<td><img src="docs/img/shots/16_boss_siroco.webp" width="270"><br><sub>魔界 · 无形棺柩（召唤师三觉）</sub></td>
<td><img src="docs/img/shots/17_abyss.webp" width="270"><br><sub>深渊派对第 2 轮：深渊领主降临</sub></td>
</tr>
<tr>
<td><img src="docs/img/shots/18_coop.webp" width="270"><br><sub>3 人组队：狂战士 + 漫游枪手 + 元素师</sub></td>
<td><img src="docs/img/shots/19_arena.webp" width="270"><br><sub>决斗场：阿修罗 vs 战斗法师</sub></td>
<td><img src="docs/img/shots/20_result.webp" width="270"><br><sub>通关结算：评价 + 翻牌</sub></td>
</tr>
</table>

### 养成与界面

<table>
<tr>
<td><img src="docs/img/shots/21_inventory.webp" width="270"><br><sub>个人信息 + 物品栏：+12 史诗全身、装备提示</sub></td>
<td><img src="docs/img/shots/22_skills.webp" width="270"><br><sub>技能窗口（K）：加点、指令、技能栏</sub></td>
<td><img src="docs/img/shots/23_enhance.webp" width="270"><br><sub>装备强化：+12 → +13，成功率与保护</sub></td>
</tr>
<tr>
<td><img src="docs/img/shots/25_cashshop.webp" width="270"><br><sub>商城：时装、宠物、光环，购买前试穿</sub></td>
<td><img src="docs/img/shots/26_mobile_fight.webp" width="270"><br><sub>手机横屏：扇形技能键 + 觉醒</sub></td>
<td><img src="docs/img/shots/27_mobile_town.webp" width="270"><br><sub>手机横屏：城镇</sub></td>
</tr>
</table>

## 特色

- **手感对着 DNF 做**：方向键 + Z / Space 的搓招指令、14 格技能栏、连击、浮空、追加浮空、霸体、抓取、受身蹲伏、觉醒取消。
- **四大职业**：鬼剑士、神枪手、魔法师，以及新开放的**男格斗家**（气功师 / 散打 / 街霸 / 柔道家，抓取、投掷、念气、连打各有一套机制）。
- **技能逐个对照官方**：19 个转职、每个技能的效果、段数、冷却、霸体 / 无敌时间都对照官方资料，并用自动化工具逐帧核对（[`docs/skills/`](docs/skills)）。
- **完整的世界**：Lv1~60 连成一条主线，从艾尔文防线、赫顿玛尔、西海岸到暗精灵、万年雪山、诺斯玛尔 / 根特、海上列车、时空之门、魔界希洛克；每日、支线、区域制霸任务。
- **装备 2.0**：约 520 件史诗、50 件领主神器，官方物品保持官方等级；强化、增幅、锻造、附魔、分解、合成、继承；套装、冷却缩减装备线；163 把重绘武器。
- **高难内容**：领主机制（预警、阶段、护盾、凝视）、深渊（深渊柱两轮战，第二轮出深渊领主）、远古地下城的房间玩法。
- **外观**：6 套时装（其中 2 套天空套）× 4 职业逐帧重画，武器装扮、宠物、光环、强化光效；转职后换发色、头饰和状态特效。
- **联机**：城镇同屏、最多 4 人组队（主机权威）、好友决斗、排位决斗场（4 秒匹配不到真人自动切 AI）、排行榜、拍卖行、邮件、公会、聊天、查看其他玩家装备。
- **手机端**：参照官方手游的扇形技能布局、滑屏键、单独的觉醒按钮和 Buff 栏。
- **在线更新不掉线**：发版后页面右下角提示，点一下自动存档、刷新，并回到原来的角色、场景和坐标。

## 快速开始（本地运行）

需要 Node.js ≥ 22.13。

```bash
git clone https://github.com/luzhipeng728/dawnbreak.git
cd dawnbreak
node build.mjs                 # 生成 dist/web/（网页版）和 dist/dawnbreak.html（离线单文件）
npx serve dist/web             # 任意静态服务器都行；或者直接双击打开 dist/dawnbreak.html
```

只想玩单机：打开 `dist/dawnbreak.html` 即可，存档保存在浏览器里。

想要联机（账号、云存档、好友、组队、决斗场）：

```bash
cd server && npm install && npm start      # 唯一依赖是 ws，数据库用 Node 自带的 node:sqlite
```

服务端部署到自己的机器，见 [`server/deploy/DEPLOY.md`](server/deploy/DEPLOY.md)。

> 仓库里不含 AI 生图的原始素材（`art/src/`，约 8 GB）；最终素材在 `art/final/`，游戏运行只需要它。

## 操作

| 按键 | 作用 |
|---|---|
| ← → ↑ ↓ | 移动，双击 ← / → 奔跑 |
| **X** | 普通攻击 / 对话 / 拾取 |
| **C** | 跳跃；↓ + C 后跳 |
| **Z** / **Space** | 指令键：方向 + Z 或 Space 放技能（如 ↓→ + Z） |
| **A S D F G H Shift** / **Q W E R T Y V** | 14 格技能栏 |
| **I** 物品 · **M** 个人信息 · **K** 技能 · **L** 任务 · **N** 世界地图 · **P** 决斗场 · **O** 设置 | 窗口 |

完整说明见 [`docs/PLAYER_GUIDE.md`](docs/PLAYER_GUIDE.md)。

## 架构

**纯前端、零运行时依赖**：原生 JavaScript，没有框架，没有打包器。

| 部分 | 规模 |
|---|---|
| 游戏源码 `src/` | 180 个模块，约 3.9 万行 |
| 服务端 `server/` | 20 个文件 |
| 测试 `test/` | 100 多个端到端测试脚本 |
| 美术 `art/final/` | 9124 个 webp，约 115 MB |

```mermaid
flowchart TB
  subgraph SRCDIR["源码"]
    direction LR
    ORDER["src/ORDER<br/>180 个模块的拼接顺序"]
    SHELL["shell_top.html<br/>shell_bottom.html"]
    ART["art/final/分类/名字.webp<br/>9124 个素材 + spr.json"]
  end
  BUILD["build.mjs：拼接 · 语法检查 · BUILD_ID · 分包表"]
  ORDER --> BUILD
  SHELL --> BUILD
  ART --> BUILD
  BUILD --> WEB["dist/web/<br/>网页版，美术按分包懒加载"]
  BUILD --> OFF["dist/dawnbreak.html<br/>离线单文件，素材内嵌"]
  RT["浏览器：同一个全局作用域<br/>engine：主循环 · 输入 / 触屏 · 实体 · 战斗 · 特效 · 音频<br/>models：精灵帧 · 外观层（武器 / 时装 / 头饰）<br/>game：玩家 · 怪物 · 地下城 · 装备 · 存档 · 区域<br/>content：职业 · 技能 · 物品 · 区域 · 任务 · 商城<br/>ui：窗口 · HUD · 小地图 · 聊天<br/>net：账号 · 云存档 · 同屏 · 组队 · 决斗"]
  WEB --> RT
  OFF --> RT
  subgraph SRV["server/（Node ≥ 22.13，唯一依赖 ws）"]
    HUB["WebSocket /ws"]
    HTTP["HTTP /api/*"]
    CORE["core：account · saves · social · party · room"]
    MODS["modules：arena · auction · mail · rank · guild · signin · notice · inspect · gm · clienterr"]
    DB[("SQLite（node:sqlite）")]
    HUB --> CORE
    HUB --> MODS
    HTTP --> CORE
    HTTP --> MODS
    CORE --> DB
    MODS --> DB
  end
  RT <-->|"JSON 消息"| HUB
  RT -->|"REST + token"| HTTP
```

### 构建：拼接成一个全局作用域

- `src/ORDER` 列出 180 个 JS 文件的顺序。`build.mjs` 把它们按顺序拼进同一个 `<script>`，没有 import / export。
- 后加载的文件可以扩展前面的定义，例如 `Object.assign(menus, { w_xxx })` 注册新窗口、`CLASSES.sword.jobs.blade = {…}` 登记转职。
- 拼好后用 `node --check` 做语法检查。版本号 `BUILD_ID` 取页面内容的哈希，内容不变版本号就不变。
- 两种产物：
  - `dist/web/`：网页版，美术按分包懒加载。
  - `dist/dawnbreak.html`：离线单文件，素材以 data URI 内嵌，双击就能玩。

### 美术分包与懒加载

- 素材放在 `art/final/<分类>/<名字>.webp`，代码里用 `IMG['<分类>/<名字>']` 取。
- `build.mjs` 的 `bundleOf` 按路径分包：

  | 分包 | 内容 |
  |---|---|
  | `core` | 图标、特效、觉醒插图，启动时加载 |
  | `spr:<角色>` | 逐帧精灵；时装是 `spr:<职业>@<套装>` |
  | `bg:<主题>` | 场景背景 |
  | `world` | 城镇建筑、门、NPC 立绘 |
  | `job` | 转职立绘 |
  | `weapon` | 武器，按 key 单独加载 |
  | `cash` | 商城、宠物、光环 |

- 什么时候加载：进城只加载这个场景用到的素材，`world` 整包 3 秒后在后台加载；进地下城时加载背景和这张图的怪物。
- 用到的函数是 `loadBundles` / `withLoading`，超过 150 毫秒才显示“加载中…”。

### 运行时

- **主循环**：逻辑固定 60 Hz（`step(1/60)`），渲染时在两个逻辑步之间插值（`lerpIn` / `lerpOut`），高刷新率屏幕也不会一顿一顿（[`docs/ANIMATION.md`](docs/ANIMATION.md)）。
- **两层画布**：世界层逻辑分辨率 960×540，放大时不做平滑；UI 层逻辑分辨率 1920×1080，高清绘制。
- **实体与动画**：`Ent` 负责物理、状态机和受击。`SpriteModel` 把动作片段映射到手绘帧。身体帧里**不画武器**，武器、时装、头饰由外观层按每帧的锚点在运行时叠上去。
- **事件总线**：`bus.on / bus.emit`（`kill`、`dungeonClear`、`roomEnter`、`levelUp`、`jobChange`…）。任务、成就、教程、房间机关都靠监听事件实现，不往战斗代码里塞调用。
- **内容全部是数据**：技能用 `defSkill`；装备用 `defineGear` / `defineSet`；城镇、NPC、地下城用 `defineScene` / `defineNpc` / `defineDungeon`；任务用 `defineQuest`。
- **区域一份 spec 生成**：`defineRegion(spec)` 从一份纯数据生成怪物（技能库 + 行为原型）、领主（阶段 + 机制库）、史诗、地下城、门、掉落、任务和深渊（[`docs/REGION_PIPELINE.md`](docs/REGION_PIPELINE.md)）。

### 联机：主机权威

服务端**不跑任何游戏模拟**，只做鉴权、成员校验和消息转发。游戏逻辑在玩家的浏览器里跑。

```mermaid
sequenceDiagram
  participant H as 队长（主机）
  participant S as 服务端（只转发）
  participant G as 队员
  H->>S: 快照（20 Hz：怪物位置 / 状态 / 血量 / 出招序号）
  S->>G: 转发，队员按快照插值
  H->>S: 事件（刷怪 / 出招 / 击杀 / 换房 / 清房，带序号）
  S->>G: 转发，重连时按序号补齐
  G->>S: 命中包（队员本地判定打中了哪只怪）
  S->>H: 转发，主机扣血
  Note over H,G: 怪物打人时，由挨打的那一方自己判定；掉落、经验、翻牌各算各的
```

| 玩法 | 做法 |
|---|---|
| 组队刷图（最多 4 人） | 只有队长模拟怪物（AI、血量、死亡、清房），怪物血量按人数加倍；队员那边的怪是“傀儡”，重播同一个招式。领主机制通过镜像事件同步 |
| 城镇同屏 | 10 Hz 位置同步，插值显示其他玩家 |
| 好友决斗 | 发起方当主机裁决命中；对方本地模拟自己的角色，按键当帧出招，只上传输入 |
| 排位决斗场 | Elo 积分和段位；4 秒匹配不到真人就给 AI 对手，本地打完再上报结果 |

**服务端**：

- 协议：HTTP `/api/*` 加 WebSocket `/ws`，消息都是 JSON。
- 模块：核心模块（账号、云存档、社交、队伍、房间）固定加载，`server/modules/*.js` 自动加载。每个模块自带数据库迁移、路由、WS 消息处理和定时任务。
- 注册：只要用户名和密码，密码用 scrypt 哈希。
- 限流：登录、注册、消息都有令牌桶限流。
- 队伍和房间只存在内存里。服务端重启后，客户端会自动把队伍和房间登记回去（[`docs/NETWORK.md`](docs/NETWORK.md)）。

### 存档

- **本地存档**：存在浏览器的 localStorage 里。带调试参数启动时用单独的开发存档，不碰正式存档。
- **云存档**：登录后自动上传（防抖 2 秒）。和云端冲突时让玩家选“使用云端存档”或“用本机覆盖云端”。服务端为每个账号保留最近 20 份历史。
- **版本迁移**：存档有版本号，按角色逐个迁移。装备 2.0 的迁移按“处理过的搬家 key”判断，每次读档都跑，分批上线也只补发一次。
- **账号共享的货币**：点券、魔盒碎片等存在账号上，由所有角色共用。

## 开发指南

### 调试参数

打开页面时加在网址后面，例如 `dist/dawnbreak.html?town&cls=gun`：

| 参数 | 作用 |
|---|---|
| `?town&cls=gun` | 直接进城 |
| `?dungeon=lorien&lv=10&diff=0` | 直接进地下城，`lv` 给同等级的装备和技能 |
| `?test&cls=mage&mon=goblin&mobs=3` | 测试房间，指定怪物和数量；加 `&boss` 让第一只是领主 |
| `?duel=sword&vs=mage&job=blade&vsjob=witch&ai=2` | 决斗场；加 `&auto` 让自己也交给 AI |
| `?art&m=sword&anim=walk` | 美术实验室：动画连拍 |
| `?bot` | 自动测试机器人 |
| `?fresh` | 忽略本地存档 |
| `?touch` · `?fps` · `?mute` · `?offline` | 强制触屏界面 / 显示帧率 / 静音 / 关闭联机 |

### 测试

测试都是无头 Chrome 的端到端测试（Playwright + 本机 Chrome，公共部分在 [`test/lib.mjs`](test/lib.mjs)）。默认测离线单文件，`WEB=1` 测网页版（按需加载），`GAME_URL=` 可以指定任意地址。

| 命令 | 用途 |
|---|---|
| `node test/flow.mjs` | 全流程冒烟测试，必跑 |
| `sh test/quick.sh` | 快速回归，56 项分 6 组并行，约 4 分钟 |
| `sh test/all.sh` | 完整回归，85 项，约 70 分钟；跑的时候不要重新构建 |
| `node test/skillaudit.mjs sword:blade --compare` | 逐帧确定性的技能体检，和官方规格 `docs/skills/*.json` 对比 |
| `node test/skillshots.mjs gun:ranger` | 技能连拍总览图，并自动标出问题 |
| `node test/pvp_balance.mjs 8 all` | 18 个职业的 AI 循环赛（不渲染快进，约 40 秒） |
| `node test/mp_coop.mjs` | 真实本地服务端 + 多个页面的组队测试（`mp_*.mjs` 同类） |

### 部署

`sh tools/deploy.sh web | server | all`：

- **web**：构建 → 上传 `dist/web` → 核对 → 最后上传 `version.json`。在线页面每 60 秒检查一次版本，发现新版本就提示玩家更新。
- **server**：先备份数据库 → 同步代码 → 安装依赖、重启服务 → 健康检查。

服务端用 systemd 管理进程，前面挂反向代理，具体步骤见 [`server/deploy/DEPLOY.md`](server/deploy/DEPLOY.md)。

### 想加点东西？

| 想做什么 | 看哪里 | 要点 |
|---|---|---|
| 转职 / 技能 | [PLAYBOOK §2.2](docs/PLAYBOOK.md) · [`content/classes/common.js`](src/content/classes/common.js) 文件头 | 新建 `src/content/classes/<职业>_<转职>.js`，技能用 `defSkill`；官方规格写进 `docs/skills/<职业>.json`，用 `skillaudit --compare` 核对 |
| 装备 / 套装 | [GEAR.md](docs/GEAR.md) · [GEAR_PLAN_60.md](docs/GEAR_PLAN_60.md) | `defineGear` / `defineSet`，装备 2.0 用 `moveEpic` / `defineNamed` / `monDrop`；`node test/gear60.mjs core` |
| 城镇 / NPC / 地下城 | [CONTENT_GUIDE.md](docs/CONTENT_GUIDE.md) | `defineScene`（出口必须双向）、`defineNpc`、`defineDungeon` + 门；`node test/world.mjs` |
| 一整个区域 | [REGION_PIPELINE.md](docs/REGION_PIPELINE.md) · [PLAYBOOK §2.3](docs/PLAYBOOK.md) | 复制 `src/content/regions/siroco.js` 只改数据 → `node test/region.mjs <id>` → 美术 `region_art.py <id>` 一条命令 |
| 任务 | `src/content/quests/*` · REGION_PIPELINE §2.3 | `defineQuest` / `defineRegionQuests`；`node test/quests60.mjs` |
| 武器装扮 | [PLAYBOOK §2.5](docs/PLAYBOOK.md) | `weapon_gen.py` → `avatar_weapons.py` → 接商城；`node test/weapons.mjs` |
| 新职业 | [CLASS_PLAN_FIGHTER.md](docs/CLASS_PLAN_FIGHTER.md) | 先上线 `ready:false` 的骨架和存档安全改动，再按块并行开发 |
| 美术 | [ART_PIPELINE.md](docs/ART_PIPELINE.md) | 见下一节 |

目录结构：

```
src/            游戏源码（engine 引擎 · models 模型 · game 玩法 · content 内容 · ui 界面 · net 联机）
art/final/      最终美术素材（webp）
art/tools/      美术流水线脚本（生图、切帧、锚点、武器、图标、区域）
server/         联机服务端
test/           端到端测试
tools/          部署与运维脚本
docs/           设计与开发文档
```

## 美术是怎么做出来的

**所有美术都由 gpt-image 生成**（`gpt-image-2.5-sunburst` / `gpt-image-2.5-flare`），再由 `art/tools/` 里的脚本切成游戏素材。

![角色流水线](docs/img/art/pipeline_character.webp)

1. **锁画风**：同一段 Q 版风格描述出现在每一条提示词里。
2. **先定设定图**：之后所有图都以它为参考图，用图生图画出同一个角色。
3. **一张图画 9 格动作**：同一张 3×3 表里，比例和画风自然一致。走路、跑步先给程序画的火柴人姿势引导。
4. **武器换成绿色标记棒**：切图时读出每帧的握点和角度，运行时换成 388 把武器里的任意一把。
5. **切帧 + 锚点**：自动去白底、统一身高、找脚底 / 头部 / 手部锚点，还有闪烁、帽子丢失、标记色残留等自动检查。
6. **时装整张重画**：同一张标记棒表加时装参考图重画，逐帧对齐。特效全部运行时画，不画进帧里。

<table>
<tr>
<td><img src="docs/img/art/costumes.webp" width="420"><br><sub>同一帧 × 6 套时装</sub></td>
<td><img src="docs/img/art/weapon_cutin.webp" width="420"><br><sub>武器一把一张图；觉醒插图 → 游戏里的横幅</sub></td>
</tr>
</table>

完整做法，包括真实提示词模板、每个工具的命令、每类素材的生图次数、踩过的坑，见 **[docs/ART_PIPELINE.md](docs/ART_PIPELINE.md)**。按这份文档，可以给游戏加一个新角色或新职业。

## 这个项目是怎么做出来的

- **模型**：Claude Opus 5.5。总共用了**一个周额度上限**，**1 天**做完。
- **分工**：
  - 一个主线程负责拆任务、审图、合并和部署。
  - 每个职业、每个区域、每个系统交给一个子智能体，在各自的 **git worktree** 里并行开发。
  - 子智能体各自写测试、对照官方资料、留下对照记录。
- **节省额度的规则**：
  - 美术先出样图，主线程只看拼好的总览图，通过后一次批量出齐。
  - 测试日常只跑自己那部分和 `quick.sh`。
  - 汇报限 10 行，做完就停。
- **沉淀**：流程、命令和踩过的坑都写在 [`docs/PLAYBOOK.md`](docs/PLAYBOOK.md)。想复用这套“AI 团队做游戏”的方法，可以直接看这份文档。

## 文档

| 文档 | 内容 |
|---|---|
| [`PLAYER_GUIDE.md`](docs/PLAYER_GUIDE.md) | 游玩指南 |
| [`ARCHITECTURE.md`](docs/ARCHITECTURE.md) | 构建、模块划分、调试参数 |
| [`PLAYBOOK.md`](docs/PLAYBOOK.md) | 开发手册、常用命令、踩过的坑 |
| [`ART_PIPELINE.md`](docs/ART_PIPELINE.md) | AI 美术流水线（gpt-image） |
| [`COMBAT.md`](docs/COMBAT.md) · [`COMBAT_JUGGLE.md`](docs/COMBAT_JUGGLE.md) · [`ANIMATION.md`](docs/ANIMATION.md) | 战斗、浮空、动画 |
| [`GEAR.md`](docs/GEAR.md) · [`GEAR_PLAN_60.md`](docs/GEAR_PLAN_60.md) | 装备体系 |
| [`REGION_PIPELINE.md`](docs/REGION_PIPELINE.md) · [`CONTENT_GUIDE.md`](docs/CONTENT_GUIDE.md) | 区域生产线、如何添加内容 |
| [`PVP.md`](docs/PVP.md) · [`NETWORK.md`](docs/NETWORK.md) · [`PERF.md`](docs/PERF.md) | 决斗场、联机、性能 |
| [`MOBILE.md`](docs/MOBILE.md) · [`JOB_VISUALS.md`](docs/JOB_VISUALS.md) | 手机端、转职外观 |
| [`CLASS_PLAN_FIGHTER.md`](docs/CLASS_PLAN_FIGHTER.md) | 新职业（男格斗家）是怎么加进来的：接入点、拆分、美术 |
| [`docs/skills/`](docs/skills) | 每个职业的技能与官方逐项对照 |

## 路线图与参与

- [x] 三大职业 15 个转职到三觉，等级上限 60
- [x] 开放注册（不需要邀请码）
- [x] 装备 2.0、深渊、决斗场、组队联机、手机端
- [x] 开放注册（只要用户名 + 密码）
- [x] **男格斗家**（气功师 / 散打 / 街霸 / 柔道家）：四个转职到三觉、原装与 6 套时装、5 类拳上武器，已开放
- [ ] 跑动动画帧重绘、转职插图更新
- [ ] 更多区域与副本

欢迎提 Issue 反馈 bug、手感问题和“和官方不一样”的地方，最好附上职业 / 转职、技能名和复现步骤；更欢迎直接提交 PR。项目会在本地自动审核每个 PR，审核通过的功能最快次日就可能更新到线上。提交前建议跑 `sh test/quick.sh`；如果完整回归暂时跑不了，请在 PR 里写明已运行的检查。提交信息使用 Conventional Commits（`feat(scope): …` / `fix(scope): …`）。

## 致谢

- 美术：OpenAI **gpt-image**（`gpt-image-2.5-sunburst` / `gpt-image-2.5-flare`）
- 代码、测试、文档：Anthropic **Claude Opus 5.5**（Claude Code 多智能体）
- 玩法和技能数据参考了《地下城与勇士》官方资料和玩家社区的公开资料

## 声明

这是一个个人的学习与同人向项目，与 Nexon、Neople、腾讯没有任何关系。《地下城与勇士》及相关名称、设定归其权利人所有；游戏中的美术为原创或 AI 生成，不包含官方素材。
