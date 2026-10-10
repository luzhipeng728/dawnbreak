# 团本重设计 · 交接文档（HANDOFF_RAID_REDESIGN）

> 2026-10-10 · 因额度用完交接。用户目标：把团本整体重做得更接近 DNF 官方（领主机制、小怪 / 精英怪机制、美术、可玩性、奖励），
> 支持 **单人引导 / 两人版 / 多队版（≥4 人起开，最多 16 人）**，希洛克之外新增 **安徒恩、奥兹玛**。
> 用户原话：「所有的东西都开招，我只看最终验证效果，也就是你推送更新到 cc 上之后自己验证没问题了喊我。」
> 即：**已授权部署到 cc（线上）**，部署后自己验证，通过再通知用户。

## 1. 做到哪了

| 块 | 状态 | 提交 / 文档 |
|---|---|---|
| 调研（安徒恩、奥兹玛、现有代码审计） | ✅ | 方案 `RAID_REDESIGN_PLAN`（见 §6）；资料大多来自搜索摘要，**未核实** |
| P1 多队模型 + 精英原语 + 奥兹玛接入 | ✅ | 544d06d1 762a2875 f1a715a6 e5917499；文档 `docs/RAID_FRAMEWORK.md` |
| raid_mech_rt 多人化（物件 / 标记镜像、传心、双球、吸血挡位、单人降级） | ✅ | 44d26aaf 704854ac |
| 希洛克重做（多队 lives、6 个破防精英、小怪真技能、哈妮尔独立精灵） | ✅ | a65b77f6 f2bae620 7a551834；`docs/RAID_SIROCO.md` |
| 安徒恩（Neo Lv60，规则 + 17 节点 + 14 领主 + 9 精英 + 融合装备 + 商店） | ✅ 内容 / ⏳ 美术占位 | 81b7f2a3 48853666；`docs/RAID_ANTON.md` |
| 奥兹玛（18 图、理智 / 混沌、次元之门、25 件融合装备、HUD、军需官） | ✅ 内容 / ⏳ 美术占位 | c07e7760 6111b104 e2477d27 fbc417fb；`docs/RAID_OZMA.md` |
| 美术流水线 + 清单 | ⏳ 进行中 | ccf8264d；`docs/RAID_ART_MANIFEST.json` |
| **部署到 cc + 线上验证** | ✅ 2026-10-10 12:36 已部署（`deploy.sh all`，版本 cd46843aabfc，不含新美术） | 线上冒烟：三团本入口 / 规则初始化 / anton_ui 13/13 / ozma_ui 全过，无报错；服务端 raid 模块已加载 |

### 测试状态（main，最近一次）
- `node build.mjs` 通过。
- `sh test/quick.sh`：99/102；唯一明确失败是 `mpmore`（`test/mp_coop_more.mjs` 的“被抓怪跟影子走”），**单独重跑 27/27 通过 → 并发负载下偶发**。
- `test/mp_raid.mjs` 91/91 通过；`server/test/raid.mjs` 108/108；`raidui` / `raidbosses` / `raidmech` 均过。
- 新增测试：`raid_teams` `raid_elite` `raid_siroco_teams` `raid_siroco_elite` `raid_mech_multi` `raid_mech_rt_multi` `anton_rules` `anton_bosses` `anton_ui` `ozma_raid` `ozma_content` `ozma_ui`。
- **没跑**：`sh test/all.sh`（完整回归）；`node test/gear60.mjs power`（安徒恩 / 奥兹玛融合装备数值未做预算验收）。

## 2. 美术：唯一没做完的大块

- 清单 `docs/RAID_ART_MANIFEST.json`：共 60 角色 / 7 背景 / 36 图标；**目前仅 2 项 done**（希洛克 `raidSiHanir`、安徒恩 `raidAnHullCrawler`），其余 pending（boss 23、elite 20、mob 15、bg 7、icon 36）。
- 流水线：`art/tools/raid_art.py` + `raid_art_spec.py`（基于 `docs/ART_PIPELINE.md`，gpt-image，并发 ≤2，429 退避；单张约 70 秒）。
- 美术智能体（会话 926da653…）若还在跑，批次顺序为：领主（三团）→ 切帧提交 → 精英 → 图标 → 背景 → 小怪，每批自动提交并刷新清单；提交信息形如 `feat(art): 团本专属美术 boss`。**额度耗尽后它也会停**，接手人需检查 `git log` 看落地了哪些，再决定是否继续生图。
- **注册方式**：素材到位后，代码里把对应 `art` 字段指过去即可；pending 的项目走旧的“现有精灵换色”回退，**游戏可玩，只是形象辨识度低**。
  - 希洛克：`src/content/raids/siroco_raid.js` 的 `SIROCO_RAID_OWN_ART` 加一行。
  - 安徒恩：`src/content/raids/anton_raid.js` 各条目的 `art`；图标 `item_raid_an_*`、`item_raid_magic_ore`、`item_raid_an_core`。
  - 奥兹玛：`src/content/raids/ozma_raid.js`、`src/content/regions/ozma.js`；图标 `item_raid_oz_*` 出现在 ASSET_SRC 后自动切换（现借用希洛克同部位图标）。
- 精灵帧名同普通怪：idle walk1-8 run1-8 atk1-4 cast1-2 low1-2 hit1-2 down getup air jump，res=2，ax/ay 脚底锚点。精灵名全局唯一（前缀 raidSi* / raidAn* / raidOz*）。
- 建议优先级：三个团本主领主 → 精英 → 图标 → 背景 → 小怪。若额度仍紧，**可以不等美术，先部署**（见 §3）。

## 3. 下一步（部署已完成，以下 2 之后若有新美术再发一次 `sh tools/deploy.sh web`）

1. `git status`（应只剩 `.playwright-cli/` 未跟踪，别提交它）；`git log --oneline | head -20` 看美术是否有新提交。
2. 如美术有新素材：注册（§2）→ `node build.mjs` → 跑相关测试（`raid_ui` `raid_bosses` `anton_ui` `ozma_ui`，或 `node test/affected.mjs`）。
3. （可选，建议）跑 `sh test/all.sh`；跑的时候**不要重新构建**，测试串行。
4. **部署**（用户已授权；先读 `CLAUDE.md` 的部署约定和 `server/deploy/DEPLOY.md`）：
   - 改了服务端（`server/modules/raid.js`、`loadRaidCore` 加载列表、`raid_*.js` 规则文件），需要 `sh tools/deploy.sh all`；`tools/deploy.sh` 已加 raid_ozma / raid_anton 等规则文件的 rsync 行（核对一下 `raid_core.js`、`raid_ozma.js`、`ozma_core.js`、`raid_anton.js` 都被同步到服务端 `lib/`）。
   - 服务端部署会先备份数据库、重启服务；组队 / 决斗中的玩家会自动恢复。SSH 别名 `cc` 本机可连通。
   - 前端会在 `version.json` 变更后提示玩家更新。
5. **线上验证**（部署后，用 Playwright 打开 https://dnf.cc.l-hate.com ）：
   - 登录 → 团本入口（桌面 `[` 键 / 营地阿甘左 / 军需官）能列出 **希洛克 / 安徒恩 / 奥兹玛** 三个团本；
   - 单人引导能开团进节点；两人 duo 流程能走通（`test/mp_raid.mjs` 的逻辑）；
   - team 档（≥4 人）在 UI 提示 / 自动分队正常（可用 `server/test/raid.mjs` 的方式模拟多客户端）；
   - 控制台无报错；`/api/health` 正常；
   - 三个团本各至少进一个节点看精英破防条件、理智 HUD（奥兹玛）生效。
6. 全部确认后**再通知用户**（不要提前喊）。

## 4. 已知限制 / 存疑（接手人要心里有数）

- **资料多为推测**：安徒恩、奥兹玛的招式 / 小怪 / 次数 / 节点对应大多没有核实，文档里用 【存疑】 / 【原创】 / 【改编】 标注。要继续核对可用 playwright-cli 读 wiki.dfo.world（被 Cloudflare 拦截）、namu.wiki、dnf.qq.com。
- 安徒恩：心脏 ×5 招式全原创、数值未调优；舰炮防御战改编（3 次充能输出窗口，没有“守右侧炮 / 变红禁无色技能”）；内尔贝电球用 `clear` 法阵表示，不是真飞行球；玛特伽没做“召唤对应精英”。
- 奥兹玛：“清夜”按“压制埃利诺斯那一轮”解释；三队轮转顺序不强制（靠存档点续血 + 锁血 + 解锁 + 团长标记）；理智小游戏是覆盖层而非官方传送房间。
- 多队：一队 = 一个 party，房间上限 4；`together` 节点按队判定，**不支持跨 party 同房**；4~5 人自动拆成至少 2 队。
- 精英运行时（刷物件 / HUD）只在房主端，访客端没镜像精英视觉和护盾倍率；**没有两个真实浏览器客户端的多队端到端测试**（队员侧用假 ghost + mirror 验证）。
- 融合装备：安徒恩 / 奥兹玛数值**未按 RAID_PLAN §4.3 跑 `gear60 power` 验收**；奖励表里融合装备 key 写死在规则文件（服务端没有物品库）。
- 共享工作区注意：并行智能体做过 `git stash`/`pop`，`src/ORDER` 的一处注释行有空白差异，非有意改动。

## 5. 文件地图

| 内容 | 位置 |
|---|---|
| 规则核心（多队、节点类型 func/key/countdown、理智 / 混沌） | `src/game/raid_core.js`（服务端 vm 加载同一文件） |
| 各团本 def | `src/game/raid_ozma.js`、`raid_anton.js`、`RAID_DEFS.siroco` 在 `raid_core.js` |
| 精英原语（6 种破防） | `src/game/raid_elite.js` |
| 领主机制（谜题） | `src/game/raid_mech.js`（纯逻辑）、`raid_mech_rt.js`（运行时 + 多人）、`raid_ozma_mech.js`（次元之门） |
| 内容 | `src/content/raids/{siroco,anton,ozma}_raid.js`、`src/content/regions/ozma.js` |
| 奖励装备 | `src/content/items/raid_{siroco,anton,ozma}.js`，商店在 `items/shops.js` |
| 服务端 | `server/modules/raid.js` |
| 客户端 / UI | `src/net/raid.js` `raid_pen.js`、`src/ui/raid.js`、`src/ui/raid_ozma.js` |
| 文档 | `docs/RAID_FRAMEWORK.md`（加新团本流程）`RAID_SIROCO.md` `RAID_ANTON.md` `RAID_OZMA.md` `RAID_PLAN.md`（历史） |

## 6. 方案原文
最初的重设计方案：`/Users/luzhipeng/.gemini/antigravity-cli/brain/b250b351-e622-43a7-a16a-cd5bfea7145f/raid_redesign_plan.md`（含现状审计、与官方差距、三团本设计、美术计划）。
