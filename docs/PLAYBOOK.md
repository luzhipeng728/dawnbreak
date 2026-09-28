# 破晓地下城 · 做事手册（PLAYBOOK）

每做完一件事，把“下次怎么更快、更省”写进这里；开工前先看这里，不要每次从头摸索。
分类：怎么做（流程）→ 常用命令 → 踩过的坑。具体系统的细节在各自文档（ARCHITECTURE / COMBAT / GEAR / NETWORK / SKILLS_OFFICIAL_* / REGION_PIPELINE）。

## 1. 通用原则（2026-09-28 总结）
- **先查现成的**：新需求先在这里、docs/ 和 tools/ 里找有没有做过的同类事；有模板就套模板。
- **能配置就不写代码**：职业技能、区域、怪物、领主机制都往“一份数据 + 通用引擎”方向做（区域见 REGION_PIPELINE.md）。
- **一次性脚本要沉淀**：线上运维、存档修改这类临时脚本，做完就放进 `tools/`，写上用法。
- **子智能体省额度规则**（用户明确要求，违反就是浪费钱）：
  1. 只做自己的范围，不重复验证别人的东西，不改别人的文件（找负责人）。
  2. 读文件用 grep / `sed -n` 片段；不整份读大文件、不把长日志贴进上下文。
  3. 测试最少：开发时只跑自己的测试；交付时跑一次 `sh test/quick.sh`（失败只重跑那一项）；不跑试玩、不跑 all.sh。
  4. 美术：样图 → 主线程审 → 批量，一次出齐，不“多抽几张比较”；审图只发一张总览图。
  5. 汇报 10 行以内；等待用后台任务 + 通知，不轮询；做完就停。
- **主线程**：多个小修改一起合并、一起跑 quick.sh、一起部署；完整回归只在大里程碑后台跑一次。
- **跟用户说中文**，结论先行，少术语。

## 2. 常用流程

### 2.1 合并一个子智能体的交付
1. `git merge --no-edit <提交>`；冲突多半在 `src/ORDER`、`test/all.sh`、`test/quick.sh`、`sprites.js`：两边都保留。
2. 只跑相关测试：该职业 / 系统自己的测试 + `node test/classes.mjs <职业:转职>`。
3. 攒几个一起 `sh test/quick.sh`（约 4 分钟，38+ 项）→ `sh tools/deploy.sh web`。

### 2.2 加一个转职（已做过 15 次，照做即可）
- 文件：`src/content/classes/<职业>_<转职>.js`（ORDER 里放在同职业后面），P1（二觉 / 三觉）可以另起 `_p1.js`。
- 登记：`CLASSES[cls].jobs[id] = { name, role, armor, awaken, awakenName, awaken2/3, growth, dmgType?, atCreate?, direct?, trial?, quests? }`；技能 `tier: 1/2/3` 按觉醒任务解锁。
- 通用钩子（common 组已做，直接用）：`S.req` 前置、`S.morph` 变形、`whenHit` 受击时可放、`S.instant` 无动作施放、`recast` 再按、`links / hitCancel` 取消白名单、`airControl / preControl`、`onCast`、`shotMod`、`beforeHurt`（受击前）、`absorbHit`（护盾）、召唤框架 `summon.js`（follower / field / attach）、异常状态（感电 / 诅咒 / 睡眠 / 定身 / 挑衅 / 束缚 / 混乱）。
- 美术：新人物动作 = 基础造型 + 6 套时装一次出齐（`art/tools/avatar_gen.py` 等）；原装帧必须戴默认帽子（`python3 art/tools/avatar_hatcheck.py`）；召唤物走 `summon_art.py → summon_scale.py → summon_strip.py`。
- 测试：写 `test/<转职>.mjs`，加进 `quick.sh` g2 和 `all.sh`；`all.sh` 的 classes 行加上 `<职业>:<转职>`。
- 体检：`node test/skillshots.mjs <职业>:<转职>` 出技能连拍总览图（`test/shots/skills/<职业>-<转职>.jpg`）+ 自动标问题（放不出 / 卡住 / 没打中 / 缺动作 / 缺图标 / 报错），主线程看一眼总览图就能发现画面问题。

### 2.3 做一个新区域
见 `docs/REGION_PIPELINE.md`（区域配置 + 怪物技能库 + 领主机制库 + 一键美术 + test/region.mjs）。
1. 复制 `src/content/regions/siroco.js` 为 `<id>.js`，只改数据（怪物 = 技能库 + 参数，领主 = 阶段 + 机制库，特殊判定才写 `<id>_bosses.js` 钩子），在 `src/ORDER` 加一行。
2. 美术前先验逻辑：`node build.mjs && node test/region.mjs <id> skills,mechs,quest`。
3. `python3 art/tools/region_art.py <id> refs,bg,review1 --sample` → 把 `review_refs.png` 发主线程；通过后 `region_art.py <id>` 一条命令跑完（可断点续跑）。
4. `node test/region.mjs <id>` 全量（含机器人 Lv30 +12 史诗通关）；难度只调 spec 顶上的 `power / bossPower / atkPower`。
5. 把 `review_final.png` 发主线程 → 提交。精灵名是全局的（`art/final/spr/<名字>`），和已有角色重名时工具会停下，改名即可。

### 2.4 美术审核（主线程）
- 看什么：画风和现有 Q 版一致；比例（和角色站一起的连拍）；时装版本逐帧对得上；**没有烘焙特效**（烟、火花、光束、动作线、眩晕圈都应该是运行时特效）；道具不能用纯绿 / 品红（切帧工具当标记用）；衣着保守。
- 多张一起审：先用 PIL 拼成一张总览图再看（省额度）。
- 常见打回：召唤物和玩家撞色（露易丝）、领主不够大（希洛克）、写实画风（第一版不动明王）。

## 3. 常用命令
| 做什么 | 命令 |
|---|---|
| 部署前端 / 服务端 | `sh tools/deploy.sh web` / `server` / `all` |
| 看所有账号、角色、点券 | `sh tools/admin/admin.sh users` |
| 给玩家发点券 | `sh tools/admin/admin.sh cera <账号> <数量>` |
| 角色全满（满级 / 任务 / 三觉 / 技能 / 最强装备 +12） | `sh tools/admin/admin.sh maxout <账号> [职业=转职,...] [额外点券]` |
| 快速回归 | `sh test/quick.sh`（约 4 分钟） |
| 完整回归 | `sh test/all.sh`（约 70 分钟，后台跑，跑的时候别重新构建） |
| 技能连拍体检 | `node test/skillshots.mjs <职业:转职,...>` 或 `all` |
| 决斗场排位服务端自测 / 联机实测 | `node --disable-warning=ExperimentalWarning server/test/arena.mjs`（约 10 秒）/ `node test/arena.mjs`（2 个页面） |
| 决斗平衡（18 职业 AI 循环赛，无渲染快进约 40 秒） | `node test/pvp_balance.mjs 8 all`；自动调 `PVP_JOB`：`node test/pvp_balance.mjs 6 all 4` |
| 浮空 / 受身蹲伏定量测试 | `node test/juggle.mjs`（参数表 `JUGGLE`，docs/COMBAT_JUGGLE.md） |
| 数据库备份 | `ssh cc 'sudo /opt/dawnbreak-server/backup.sh'`（每天 04:17 也会自动备份） |

改完存档让玩家**刷新页面**，弹“存档冲突”时选**使用云端存档**。

## 4. 踩过的坑（别再踩）
- **完整回归跑的时候重新构建** → 正在加载页面的测试超时（bestiary 就这么挂过一次）。
- **并行负载下的偶发失败**：测试里用固定 sleep / 墙钟时间判断会误报。一律按 `game.t` 或条件等待；站在掉落物上会被自动拾取（gear 测试）。
- **Mac 键盘**：Option(Alt) 当技能键不好用 → 第 7 格默认改成左 Shift；Ctrl 这类修饰键绑定的界面开关要“单独按下再松开”才触发（避免 Mac 截图快捷键误触）。
- **地面法阵**：`drawSpr(..., { ground: true, rot })` 才是躺在地上转；只写 rot 会像立着的圆盘原地转。
- **大横幅会盖住窗口**：设置类开关的提示写进系统消息（`toastMsg(..., 'log')`）。
- **找人用角色名**：玩家输入的多半是角色名，服务端 `ctx.findPlayer` 先按账号名、再按角色名找。
- **点券是账号共享的**（`save.acct`），角色身上的旧余额读档时并入。
- **子智能体改 combat.js / player.js 容易冲突**：这些文件只让一个组改，其他组发需求。
- **PIL 画中文**：用 `/System/Library/Fonts/STHeiti Medium.ttc`，PingFang.ttc 读不出中文字形。
- **生图接口**：`~/.claude/skills/gpt-image` 已改成三家中转自动切换（首选两家各重试 3 次，最后 hyprlab 兜底），图生图走标准 `/images/edits`，不再受上传 5 次/分钟限制。

## 5. 复盘记录
- **2026-09-28 官方技能 / 15 个转职对齐**：一开始每个职业组都从零调研、每次跑完整 all.sh（65 分钟）、样图逐张来回审，额度烧得快。改进后：quick.sh 4 分钟、样图拼总览一次审、成本规则写进每个子智能体的任务里、做完就停——后半程每个转职的消耗明显下降。下次同类工作直接按第 2.2 节做。
- **2026-09-28 区域**：以前每个区域都是手写（约 60~120 万 token / 个）→ 改成区域生产线（配置驱动），目标 15~30 万 token / 个。
  - 第一个区域（希洛克）连同整条流水线一起做，约 44 万 token；贵在：读老区域代码摸接口、写技能库 / 机制库 / 生成器 / 测试，以及两处踩坑（精灵名 `phantom` 和已有角色重名被覆盖；`summon_scale` 会偷偷改 `sky_art` 的全局表），还有按 +12 史诗重新调难度（第一版 90 秒通关）。
  - 下个区域跳过：读代码（看 REGION_PIPELINE.md 的参数表）、手写怪物 AI / 领主机制 / 测试 / 美术脚本，只写 spec + 看两张审图 + 调三个难度旋钮，预计 12~18 万 token。
- **2026-09-28 决斗场排位 + 公正决斗 + 浮空重做**：平衡别靠手调——AI 循环赛直接调 `step()` 快进（153 对 × 8 场只要 40 秒），加个自动迭代调参，几轮就把 3%~87% 收到 46%~59%；浮空问题先写定量测试（滞空 / 再挑 / 连击上限）量出“以前”的数，再改模型。改完浮空、霸体窗口这类全局规则后，一定重跑循环赛。
