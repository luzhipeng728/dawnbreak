# 破晓地下城 · 交接文档（HANDOFF）

写给新加入的智能体（或人）。读完这一份就能开工；细节按链接去读对应文档，不要一上来通读全仓库。
最后更新：2026-09-30。维护：主线程（每合并一批就更新 §5 和 §6）。

---

## 1. 这是什么
- 浏览器里的《地下城与勇士》(DNF) 复刻：横版格斗刷图，Q 版画风，等级上限 60，四个职业（鬼剑士 / 神枪手 / 魔法师 / 男格斗家）19 个转职到三觉。
- 线上：https://dnf.cc.l-hate.com （cc 服务器；后台 `/admin/`，管理员账号登录）
- 仓库：https://github.com/luzhipeng728/dawnbreak （**公开仓库**，见 §7 安全规则）
- 本地路径：`/Users/luzhipeng/projects/dawnbreak`
- 用户（项目主人）说中文；汇报用中文，结论先行，少术语。

## 2. 开工前必读（按顺序，只读需要的段落）
1. `README.md`：总览、架构图、目录结构。
2. `docs/PLAYBOOK.md` **§1 通用原则**（省额度规则，必须遵守）+ §2 你要做的那类流程 + §3 常用命令 + §5 踩过的坑。
3. `docs/ARCHITECTURE.md`：构建方式、模块归属、调试参数。
4. 按任务再读：战斗 `COMBAT.md` / `COMBAT_JUGGLE.md`，装备 `GEAR.md` / `GEAR_PLAN_60.md`，区域和领主 `REGION_PIPELINE.md` / `BOSS_PLAN.md`，联机 `NETWORK.md`，决斗 `PVP.md`，手机 `MOBILE.md`，美术 `ART_PIPELINE.md` / `ANIMATION.md` / `JOB_VISUALS.md`，职业技能 `SKILLS_OFFICIAL_*.md` + `docs/skills/`。

## 3. 代码怎么组织（最容易踩坑的几条）
- **没有模块系统**：`src/ORDER` 里的 JS 按顺序拼进同一个 `<script>`，共享一个全局作用域。新文件要在 ORDER 里加一行。
- **全局重名会静默覆盖**：两个文件写了同名的 `function xxx`，后加载的会盖掉前面的（已经出过两次 bug：领主护盾特效、地下城左右门）。新写全局函数前先 `grep -rn "function 名字" src`。
- **注释只能写在行尾或单独一行**，不要写在一行代码中间（`a(); // 注释 b();` 会把 `b()` 注释掉）。
- 界面用 `h(tag, attrs, ...children)` 拼 DOM，它会跳过 null；不要 `append(null)`（会显示成 "null"）。
- 能配置就不写代码：职业、区域、怪物、领主机制都是“一份数据 + 通用引擎”。
- 美术最终素材在 `art/final/<分类>/<名字>.webp`，代码里用 `IMG['<分类>/<名字>']`。AI 生图原图在 `art/src/`（不进 git，只在主仓库本地）。
- 存档兼容：改存档结构要写迁移（`src/game/save.js` 的 `migrate`），老角色数据不能丢。

## 4. 常用命令
| 做什么 | 命令 |
|---|---|
| 构建 | `node build.mjs`（输出 `dist/web/` 和离线单文件 `dist/dawnbreak.html`） |
| **只跑受影响的测试（日常用这个）** | `node test/affected.mjs`（按改动的文件自动挑测试，2 路并行；`--dry` 只看挑了哪些，`--base <提交>` 指定比较起点，`--only a,b` 只跑其中几项）；规则表在文件里的 `RULES`，新加的测试要是没被挑中就往里加一行 |
| 快速回归（约 9 分钟，74 项，3 路并行） | `sh test/quick.sh`：**只由主线程在合并一批后跑**；和 affected 共用全局锁，同一时间只有一套测试在跑，别的排队 |
| 单个测试 | `node test/<名字>.mjs`（无头 Chrome） |
| 完整回归（约 70 分钟） | `sh test/all.sh`，只在大里程碑后台跑 |
| 调试网址 | `?town&cls=gun` 直接进城、`?dungeon=lorien&lv=10`、`?test&cls=mage&mon=goblin&mobs=0` 测试房间、`?rawcd` 原始冷却、`?fresh` 空存档 |
| 技能体检 | `node test/skillshots.mjs <职业:转职>`（连拍总览）、`node test/skillaudit.mjs <职业:转职> --compare`（对官方规格） |
| 领主体检 | `node test/boss.mjs <地下城>`（P0-T 正在做，合并后可用） |
| 联机测试 | `node test/mp_*.mjs`（在 worktree 里要先软链主仓库的 `server/node_modules`，提交前删掉软链） |

**已知偶发失败**（并行负载下偶尔挂，单独重跑能过就不算问题）：`mobile`（摇杆快速拨两下 = 跑）、`region`（深渊翻牌）、`brawler`（时序）、`combat`（格挡）、`mpabyss`、`fighter_nen`（龙虎啸眩晕）、`compare`、`gear_sim`（抽样）。

## 5. 怎么参与（协作规则）
1. **认领任务**：在 §6 里挑一个“可认领”的任务，先在协作板 `.team/board.md`（主仓库本地文件，不进 git）末尾追加一条：`## [时间] 你的名字 → 主线程：认领 <任务>`，写上你要改的文件。**只追加，不删改别人的条目。**
2. **在自己的分支 / worktree 里做**：
   ```sh
   cd /Users/luzhipeng/projects/dawnbreak
   git worktree add .claude/worktrees/<你的名字> -b <你的名字>/<任务> main
   ```
   **不要直接在主仓库目录（main 分支的工作区）里改文件和提交**，主线程和其他智能体都在用它；一律在自己的 worktree 分支里做。
   只改你认领的文件；需要改别人正在改的文件（见 §6 “进行中”一栏的文件归属），先在协作板上说。
3. **提交格式**：Conventional Commits，`type(scope): 描述`（例：`feat(boss): 格兰之森领主加扇形吐息`），正文最后一行：
   `Co-Authored-By: <你的模型名> <noreply@anthropic.com>`
4. **交付前**：`node test/affected.mjs`（自动构建 + 跑受影响的测试；失败项单独重跑确认是不是偶发）。不要跑 quick.sh / all.sh，那是主线程合并后的事；不要在测试跑的时候重新构建。
5. **不要部署**。`tools/deploy.sh` 只由主线程执行；也不要推 GitHub。做完在协作板写“已完成：分支名 + 提交号 + 测试结果 + 截图路径”，主线程合并、跑回归、部署。
6. **美术**：
   - 流程：先出样图（一张总览），主线程审过再批量。
   - 并发：生图共用一个账号，并发 3 路就会被限流（429），**全局同一时间只允许一个生图请求**。要生图先在协作板排队。
   - 工具：用 `gpt-image` 技能，流程见 `docs/ART_PIPELINE.md`。
7. **汇报**：10 行以内，中文；写清证据（测试输出、截图路径），做不到的直说。
8. **线上操作**（`tools/admin/admin.sh` 发邮件、改存档、`maxout` 等）会改真实玩家数据，必须是用户或主线程明确要求才做。不要在线上服务器跑自动化测试（会留垃圾账号）。

## 6. 任务看板

### 6.1 进行中（别碰这些文件）
| 任务 | 负责 | 文件 |
|---|---|---|
| 领主引擎原语 P0-E（约 20 个新机制 / 技能 / 特性、`defineBossKit`、多领主、组队同步）+ 斯卡萨之巢机制样板 | 主线程的子智能体 | `src/game/mon_skills.js`、新 `src/game/mon_skills_ext.js`、`region.js`、`dungeon.js`、`monsters.js`、`content/sprites.js`、`content/abyss.js`、`net/coop_mech.js`、`docs/BOSS_SPEC.md` |
| 领主测试和工具 P0-T（`test/boss.mjs`、查重、生图工具的 sig / forms，59 个领主基线） | 主线程的子智能体 | `test/boss.mjs`、`tools/boss_inventory.mjs`、`art/tools/region_art.py`、`docs/REGION_PIPELINE.md` §3~5 |
| 素材清理（删没用到的素材、压缩过大的图、离线单文件改成可选） | 主线程的子智能体 | `art/final/**`、`build.mjs`、`tools/deploy.sh`、`docs/ASSET_AUDIT.md` |

### 6.2 等 P0 合并后可认领（领主机制按区域，规划见 `docs/BOSS_PLAN.md` §2 目标、§4.1 写法、§7 分块）
| 块 | 区域 | 难度 | 说明 |
|---|---|---|---|
| R1 | 格兰之森 + 天空之城 + 天帷巨兽 + 远古 | 简单（只写配置） | 老领主只用 `defineBossKit` 挂阶段和机制，不改原来的 AI |
| R2 | 暗精灵 + 万年雪山 | 复杂 | 熔岩穴三兄弟、王的遗迹五骑士、无头骑士新形象、诺伊佩拉分裂、布万加四勇士、冰雪宫殿王座 |
| R3 | 诺斯玛尔 + 根特 + 深渊词条 + 领主曲 | 简单 | 深渊词条要等 R2 / R4 / R5 的钩子合并 |
| R4 | 海上列车 + 时空之门 | 复杂 | 赫伊斯雾 + 掩体、阿登机械形态、瘟疫 debuff、圣战护送 |
| R5 | 希洛克 | 复杂 | 四门按官方对调（任务文本和掉落表同步改） |
| ART | 美术队列（唯一生图的块） | 复杂 | 先出利库样板；新领主和形态 18 张、招牌动作表 49 张、领主房背景 12 张 |

每个领主的验收：轮廓或换色 + 缩放能明显区分；至少 2 个招牌机制；预警清楚、有生路；组队双方一致；用时在基线区间内（`docs/BOSS_PLAN.md` §4.5）。

### 6.3 其他可认领的小任务（backlog）
- **地下城房间左右的门没画出来**：`src/game/dungeon.js` 的 `drawGate` 被 `world.js` 同名函数覆盖。把 dungeon.js 那个改名（如 `drawRoomDoor`）就能恢复。这会改变画面，先截图给主线程审。
- **全仓库查一遍同名全局函数**：写个脚本放进 `tools/`，接进 quick.sh，发现重名就失败。已知还有 `armorSet`（`epics.js` / `epics60_armor.js`，一个在块里，目前没出问题），要确认。
- **决斗**：召唤师、剑魂的个别觉醒一下能打掉 50%~68% HP，要压一下单次爆发（`src/game/duel.js`，要重跑 `node test/pvp_balance.mjs 6 all 4`）。
- **格斗家**：
  - 街霸、柔道家的技能规格还没写进 `docs/skills/fighter.json`。
  - 气功师幻影爆碎的段数和规格对不上。
  - 东方棍武器装扮只换色没有花纹，臂铠 6 款装扮外形相同。
  - 具名史诗武器的“技能等级 +N”特效没做。
- **异界套装**：阿修罗、鬼泣、剑影、弹药专家、机械师、协战师、召唤师、魔道学者、小魔女还没有。
- **测试本身的问题**：`test/mobile.mjs` 松开手指的写法是反的，双指检查可能碰巧通过（正确写法见 `test/mobile_fighter.mjs`）。
- **机械师**：按魔法口径算，Lv40 ×0.86、Lv60 ×1.15，超出 ±10%（gear60 测试里标成已知）。

## 7. 安全规则（仓库是公开的）
- 不要把任何密码、token、密钥、中转服务地址、服务器 IP 写进仓库（代码、文档、测试、提交信息都不行）。
- 管理员名单在服务器的 `dawnbreak.env` 里，不在仓库。加管理员必须先在游戏里注册那个用户名，再写进 `DNF_ADMIN`，因为注册是开放的。
- 数据库、配置、玩家存档：没有明确授权不删、不改。改之前先备份（`ssh cc 'sudo /opt/dawnbreak-server/backup.sh'`）。

## 8. 最近的状态（2026-09-30）
- 已上线：
  - 男格斗家四个转职：拳上武器改成整只手重画，装备补齐到 72 把史诗和异界套装。
  - 决斗场新规则：血量 ×1.7，开局 3 秒保护，开局冷却，浮空一级 / 二级保护，倒地 1.6 秒强制起身。
  - 技能：一键加点，SP ×6。
  - 后台 `/admin`；注册不再需要邀请码。
- 规划中：领主机制按官方逐个对齐（`docs/BOSS_PLAN.md`），这是当前最主要的工作。
