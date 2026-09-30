# 新职业计划 · 男格斗家（`fighter`）

> 用户目标（2026-09-30）：“今天目标是添加一个职业，男格斗家”。国服现版、Q 版画风、官方技能、4 个转职做到三觉，质量和现有三职业一样。
> 本文 = 调研 + 计划，**还没有改代码**。官方技能细节见 `docs/SKILLS_OFFICIAL_fighter.md`；做事流程见 PLAYBOOK §2.2（加转职）/ §2.5（加武器装扮）。
> 规模一句话：接入点 **63 处**（其中约 17 处跟着 `CLASSES` 自动生效）；技能 **130 个**（鬼剑士 118、神枪手 115、魔法师 133）；动作帧约 **110 帧 ×7 套**；生图老流水线约 **230 次**，推荐做法一期约 **130 次** + 二期具名史诗武器 40~70 次。

---

## 0. 结论

| 项 | 结论 |
|---|---|
| 能不能照抄现有三职业的接法 | 能。职业是“一份 `CLASSES[cls]` + 若干硬编码表”，没有需要重构的地方；最大的新东西是**拳上武器的外观**（双手锚点）和**投技**（抓取框架已有，要补多目标 / 抓倒地 / 空中投） |
| 存档风险 | **有一处必须先修**：`src/game/save.js:26` / `src/net/account.js:135` 读档时把不认识的职业的角色**直接丢掉**——老页面读到带格斗家的云存档再写回去，角色就没了。B0 先修、先部署，再开放创建 |
| 上线方式 | `CLASSES.fighter.ready = false`（选角已支持“即将开放”）→ 基础职业做完先开；每个转职加 `J.ready`，哪个做完开哪个 |
| 导师 | 官方导师**风振**，本作已有（`fengzhen`，赫顿玛尔中央广场 `hm_plaza`，“格斗家导师”，有立绘，主线 q_m05~q_m10 在用；现在只有 quest 服务，台词写着“格斗家职业尚未开放”），加 `job` 服务 + `jobFor: 'fighter'` 即可 |
| 已经预留的 | `progress.js:50` `CLASS_BASE4.fighter`（现在力 8，官方男格斗是 7）、`progress.js:60` `CLASS_ARMOR.fighter = 'light'`；布甲 / 轻甲 / 重甲的物品和精通都已存在 |
| 和现有职业最不一样的 | 两个转职是魔法职业（气功师、街霸）、拳套只有散打能装、投技（柔道家整树）、散打的次数制柔化、街霸的多种投掷物装填、气功的能量槽 + 念气珠环绕 |
| 并行 | B0（半天，无美术）之后 8 个块并行：B1 原装帧、B2 外观、B3 基础职业、B4~B7 四个转职、B8 装备任务指南、B9 决斗 AI 联机（§4） |

---

## 1. 接入点清单（file:line）

“自动” = 循环 `CLASSES` / 按 `SPR_DATA` 判断，加了 `CLASSES.fighter` 就生效，不用改。块号见 §4。

### 1.1 职业注册与战斗
| # | 位置 | 现在是什么 | 要做什么 | 块 |
|---|---|---|---|---|
| 1 | `src/ORDER:34-53` | 职业文件按职业排 | 在魔法师后面加 `fighter.js` + 4 个转职文件（+ 可选 `_p1`）空壳 | B0 |
| 2 | `src/game/player.js:35-37` / `gunner.js:247` | 只有鬼剑士基础在 player.js，其余在各自文件 `CLASSES.gun = {…}` | `fighter.js` 里 `CLASSES.fighter = { name:'格斗家', ready:false, hp0…, acts, skills, start, bar, cmds, jobs, passives }` | B0→B3 |
| 3 | `src/game/player.js:48-52` makePlayer | `C.model()`，缺省 `buildSwordsman()`、`CLIPS[cls] ‖ CLIPS.sword` | 自动；B0 给占位模型 `buildSwordsman(PAL_FIGHTER, { weapon: null, … })` | 自动 |
| 4 | `src/content/classes/common.js:34/48/56` classSkills / cmdLabel / addCommonSkills | 循环 CLASSES | 自动（后跳-强化等通用技能自动加进来） | 自动 |
| 5 | `src/game/progress.js:46-50,60` | `CLASS_BASE4.fighter`（力 8）、`CLASS_ARMOR.fighter='light'` 已有 | 力 8 → 7（官方男格斗 7 / 7 / 4 / 4） | B0 |
| 6 | `src/game/progress.js:62` JOB_ARMOR / `J.armor` | 按转职 id 查护甲精通 | 4 个转职的精通（见 §2）写在 `J.armor` | B0 |
| 7 | `src/game/progress.js:125` dmgType | `J.dmgType ‖ C.dmgType ‖ (mage ? mag : phys)` | 气功师、街霸是魔法职业：`J.dmgType:'mag'` + `growth: { int, spr }`（同机械师 `gun_mechanic.js:1101`） | B0（登记）/ B4、B6 |
| 8 | `src/game/gear.js:55` mainStatOf | 按 dmgType | 自动 | 自动 |
| 9 | `src/engine/combat.js:272-300` 抓取 | 单目标 `a.grabbed`；`canGrab` 不抓倒地、不抓领主（`grabBoss` 例外）；`act.hold` 自定义位置、`throwGrab` | 柔道 / 基础背摔要的：多目标抓取、抓倒地、空中投、投掷弧线 helper（§2.4） | B0-E |
| 10 | `src/content/sprites.js:19-60` SPR_ANIMS | 每职业一段动画表 | 加 `SPR_ANIMS.fighter = { ...BASE_ANIMS, … }`，新帧全用 `sprOr` 兜底 | B0（表）/ B1（帧） |
| 11 | `src/content/sprites.js:99,101,114` | 写死 `['sword','gun','mage']`（走跑节奏、补骨骼片段、换成精灵模型） | 加 `'fighter'` | B0 |
| 12 | `src/engine/rig.js:62`、`src/models/poses.js:58` | 骨骼片段命名表写死三职业 | 加 `CLIPS.fighter` | B0 |
| 13 | `src/content/sprites.js:97` | 转职自带动画 `J.anims` 自动并入 | 自动（转职块各写各的 `J.anims`，帧名用各自前缀） | 自动 |
| 14 | `src/ui/charselect.js:124-130` | 按 CLASSES 列卡片，`ready===false` 显示“即将开放” | 自动；卡片立绘 `class/fighter`（:31） | 自动 / B1 |
| 15 | `src/ui/job.js:10` JOB_MENTOR | `{ sword:'gsd', gun:'kiri', mage:'sharan' }` | 加 `fighter:'fengzhen'`；加 `J.ready===false` 不显示（现在没有这个开关） | B0 |
| 16 | `src/ui/hud.js:276`、`common.js:104` cutinWho | 觉醒插图 `cutin/<转职>{,2,3}` → `cutin/<职业>` | 美术（每转职 3 张 + 职业 1 张） | B4~B7 / B1 |
| 17 | `src/ui/skillwin.js:13-26`、`src/engine/touch.js:243`、`src/ui/menus.js:324`、`src/ui/artlab.js:5` | 按 CLASSES / jobs | 自动 | 自动 |
| 18 | `src/game/flow.js:6-11,32` | `?cls=` 调试参数、按 `spr:<cls>` 分包加载 | 自动（分包不存在时 loadBundles 直接跳过） | 自动 |

### 1.2 存档 / 联机 / 服务端
| # | 位置 | 现在 | 要做 | 块 |
|---|---|---|---|---|
| 19 | `src/game/save.js:26` | `chars.filter(c => c && CLASSES[c.cls])`：**不认识的职业整个角色丢掉** | 改成保留（原样存着、选角显示“需要更新”，不能进入）；先部署一版 | B0 |
| 20 | `src/net/account.js:135` localChars | 同上的过滤 | 同上 | B0 |
| 21 | `src/game/save.js:12-13,109-117` defaults / newGame → `inv.starter(cls)` | 按 `CLASS_START_WEAPON` 给初始武器 | 自动（#24 加了就行） | 自动 |
| 22 | `src/net/town.js:21`、`src/net/coop.js:184-185` | 没有 `SPR_DATA[cls]` 时按鬼剑士画 | 自动（美术前别人看到的是鬼剑士，可接受） | 自动 |
| 23 | `server/modules/arena.js:26-27,176` | `AI_POOL` 只有三职业、`ALL18`；**`AI_POOL[ch.cls] ? : 'sword'`：格斗家排位会被记成鬼剑士** | 加 `fighter: [null, 4 转职]`，ALL18 → ALL22；服务端部署 | B9 |
| 24 | `server/core/social.js:10-16` cleanChar（同屏 / 查看信息 `server/modules/inspect.js:41` 共用）、`server/core/saves.js` | `CLS_RE = /^[a-z]{2,12}$/`；云存档不看职业 | 自动 | 自动 |
| 25 | `src/net/party_sync.js` | 全队 BUFF / 光环同步（协战师、小魔女） | 气功师若有给队友的念气 BUFF / 护盾，走这里 | B4 |

### 1.3 武器 / 装备 / 商店
| # | 位置 | 现在 | 要做 | 块 |
|---|---|---|---|---|
| 26 | `src/game/items.js:19-33` WTYPES | 15 类，每类 `cls` | 加 5 类（§2.2），`cls:'fighter'` | B0 |
| 26a | `src/game/items.js:277`、`src/ui/items/compare.js:52`、`src/ui/items/shop.js:116`、`src/ui/items/common.js:132` | 武器只按 `it.cls` 判断能不能装 | 拳套只有散打能装：加 `WTYPES[t].jobs` 判断（4 处同一个 helper） | B0 |
| 27 | `src/game/items.js:35-36` | `CLASS_WTYPES` 自动；`CLASS_START_WEAPON` 写死 | 加 `fighter:'knuckle'`（官方：不装武器按手套算） | B0 |
| 28 | `src/game/items.js:182,518` | 初始武器 / 图标兜底 `icon/item_w_<类型>`、`icon/w_<职业>` | 图标 5 + 1 张 | B2 |
| 29 | `src/content/items/gear.js:18-33,59-80` | 每类武器的品级名 `WEAPON_NAMES`、官方名 `OFFICIAL_NAMES`（缺了不报错，用通用名） | 5 类的名字 | B0 / B8 |
| 30 | `src/content/items/shops.js:23-26` | 每职业一行“XX武器” | 加“格斗家武器” | B0 |
| 31 | `src/content/items/cdr60.js:53` | 流沙武器按 WTYPES 自动生成 | 自动；图标 `item_sand_<类型>` ×5（`gear_icons_cdr60.py`） | B2 |
| 32 | `src/content/items/epics*.js`、`epics60_w_{sword,gun,mage}.js`、`droptables.js` | 每类约 13~18 件具名史诗（代码 `ep_<缩写>_*`） | 新文件 `epics60_w_fighter.js`（ORDER 里放在 `epics60_w_mage.js` 后）+ 掉落 / 深渊登记（GEAR_PLAN_60 §6.1 的接口） | B8 |
| 33 | `src/game/drops.js:26,36`、`src/ui/social/auction.js:51`、`src/content/cash/catalog.js:150` | 按职业过滤武器 | 自动 | 自动 |
| 34 | `src/content/avatar/weapon_art.js` | `avatar_weapons.py` 生成 | 重跑生成 | B2 |
| 35 | `src/content/avatar/looks.js:7-10,107-116` | 武器装扮 6 款 × 每类、默认外观、随机外观 | 自动（要有图） | 自动 |

### 1.4 外观
| # | 位置 | 现在 | 要做 | 块 |
|---|---|---|---|---|
| 36 | `src/models/avatar.js:15` AVATAR_CLS | 三职业 + pmsuit | 加 `fighter` | B0 |
| 37 | `src/models/avatar.js:70-86` | 每帧 `wpn` / `wpn2`（双持）+ 握拳像素盖回 | 拳套 / 手套 / 臂铠要“包住拳头”：新增 `A.cover`（画在手上面、不盖回握拳） | B2 |
| 38 | `src/content/avatar/looks.js:35-55` | 15 件时装配件的 `pos[职业]` / `pos[职业@]` | 按格斗家头部锚点校准 30 个位置 | B2 |
| 39 | `src/content/avatar/looks.js:63` AVATAR_HAT_CLS | 默认造型自带帽子的职业 | 男格斗家不戴帽子 → 不加 | — |
| 40 | `src/content/avatar/job_looks.js` | `JOB_LOOKS[转职]` + `job_*` 头饰 `pos[职业]` | 4 条 | B2 |
| 41 | `src/models/job_fx.js:15,168-170` | `JL_EYE`、`JL_HAIR_PICK` 按职业 | 加格斗家（发色可染就染） | B2 |
| 42 | `src/game/world.js:214-219` | 城镇路人职业 `CROWD_CLS` + 换色 `CROWD_LOOKS` | 有帧后加 | B2 |
| 43 | `src/game/vanity.js` | 强化光效围着武器图画 | 自动；拳套很小，光效大小要看一眼 | B2 |

### 1.5 任务 / NPC / 转职
| # | 位置 | 现在 | 要做 | 块 |
|---|---|---|---|---|
| 44 | `src/content/world/towns.js:51-53` fengzhen（赫顿玛尔中央广场） | `services:['quest']`，台词“格斗家职业尚未开放” | 加 `'job'`、`jobFor:'fighter'`，换台词 | B0 |
| 45 | `src/content/quests/job.js:14-44` | `JOB_CHAINS` / `AWAKEN_MORE` 每职业一段（七次修炼模板 + 觉醒台词） | 加 `fighter` 一段（风振的台词） | B8 |
| 46 | `src/content/quests/job.js:116` | 自动登记 `J.quests` | 自动；每个转职的专属转职任务线写进新文件 `content/quests/fighter.js`（照 `witch.js`） | B8 |
| 47 | `src/content/quests/main.js:53-103` | 主线 q_m05~q_m10 已经在用风振 | 不动 | — |

### 1.6 决斗 / AI
| # | 位置 | 现在 | 要做 | 块 |
|---|---|---|---|---|
| 48 | `src/game/duel.js:9-13` DUEL_BASE | 每职业一行 PvP 基准属性 | 加 fighter（B0 先抄鬼剑士） | B0→B9 |
| 49 | `src/game/duel.js:52-56` PVP_JOB | 每转职一个修正（循环赛自动调出来的） | `fighter:` + 4 个，先 1，再跑 `pvp_balance` | B9 |
| 50 | `src/game/duel.js:167,182` | 随机对手、职业按钮写死三职业 | 加 fighter | B0 |
| 51 | `src/game/fighter_ai.js:110,135-163` | 远程判断、神枪手 / 魔法师专属招式 | 格斗家：近身 + 抓取 + 投技后追击 | B9 |

### 1.7 测试 / 工具
| # | 位置 | 要做 | 块 |
|---|---|---|---|
| 52 | `test/classes.mjs:7`、`test/quick.sh:21,23`、`test/all.sh:33,37,45,53,62-63,71,75`、`test/combat_all.sh:6,9` | 加 `fighter` / `fighter:<转职>`、`test/fighter*.mjs`、`skillaudit fighter … --compare` | B0 骨架，各块补 |
| 53 | `test/skillshots.mjs:15,19`、`test/awkcancel.mjs:8-9`、`test/pvp_balance.mjs:12-14` | 写死的职业 / 转职列表 → 改成读 `CLASSES`（跳过 `ready===false`） | B0 |
| 54 | `test/jobvisuals.mjs:23,62,67,112,126-127,292`、`test/avatar.mjs:41,167,276`、`test/compare.mjs:6`、`playthrough.mjs:7`、`ui.mjs:92`、`perf.mjs:3`、`levelcap.mjs:91`、`region.mjs:487` | 同上 | B0 |
| 55 | `test/weapons.mjs:95,126-128`、`test/gear60.mjs content`、`test/cdr60.mjs` | 检查“所有 WTYPES 都有武器图 / 图标 / 数量下限”→ **B0 加了 5 类就会失败**；改成跳过 `ready===false` 职业的类型 | B0 |
| 56 | `docs/skills/fighter.json` | skillaudit 规格（`_meta` 照 sword.json）；各块填自己的技能 | B0 骨架 |
| 57 | `tools/admin/maxout.mjs`、`tools/skillgrid.mjs` | 自动（用法 `fighter=grappler`） | 自动 |

### 1.8 美术工具（`art/tools`，原图在主仓库 `art/src`，不进 git）
| # | 位置 | 要做 | 块 |
|---|---|---|---|
| 58 | `sheets2.py:34` PLAYERS、`combatgen.py:21` HOLD、`frames.py:17-21` HEIGHT、`frames2.py:22` NAMES | 加 fighter（身高 ~120，和鬼剑士 118 站一起） | B1 |
| 59 | `avatar_gen.py:23,40,58,288,497,513,561,723` | 原武器描述、占位棍提示词、每职业武器类型、角色描述 | B1 / B2 |
| 60 | `avatar_frames.py:396`、`avatar_hands.py:14` GLOVE、`avatar_head.py`、`avatar_align/check/cuts/flicker/sizecheck/crossscale/review.py` | 职业映射、手套颜色（副手锚点）、头部锚点、各种体检 | B1 |
| 61 | `job_head_art.py:24-35`、`jobvis_art.py` | 4 件转职头饰、状态特效素材 | B2 |
| 62 | `weapon_gen.py:21-72`（类型设计、`THICK`）、`avatar_weapons.py:29` HAND、新 `wdesign_fighter.py`、`gear_icons.py` / `gear_icons_cdr60.py:28-60` / 新 `gear_icons_pink60_fighter.py` | 5 类武器的设计 / 手持比例 / 图标 | B2 / B8 |

### 1.9 文档
`docs/PLAYER_GUIDE.md:10,90,135,141`（选职业、导师表、转职表）、`docs/dnf_reference.md §6.2`、`docs/SKILLS_OFFICIAL_common.md §8`（转职数量）、`docs/JOB_VISUALS.md §5`、`docs/PVP.md`、`docs/GEAR.md`、`docs/ARCHITECTURE.md`（文件归属）→ B8。

---

## 2. 官方设计摘要（详见 `docs/SKILLS_OFFICIAL_fighter.md`，来源 namu 2026-07 / DFO wiki / 国服怀旧库 / 官网三觉专题）

### 2.1 基础
| 项 | 官方 | 本作做法 |
|---|---|---|
| 定位 | “下半身”格斗家：**主要用腿**（上踢代替上勾拳、膝击代替背摔），和女格斗对称 | 美术按腿技设计（§3.2） |
| 四维 | 力 7 / 体 7 / 智 4 / 精 4（DFO，和男鬼剑一样）；HP / MP 没查到；光抗 +20、暗抗 −20；负重 43 kg | `CLASS_BASE4.fighter` 现在是力 8 → **改 7**；HP / MP 抄鬼剑士（`player.js:36`）；光 / 暗抗写进职业 |
| 转职方式 | 现版创建角色时直接选；经典版在**赫顿玛尔中央广场的风振**处接转职任务（林纳斯引荐） | 照本作惯例（common §8）：Lv15 找风振 → 选转职 → 经典任务线 |
| 普攻 | 4 段：快拳 → 下段踢（贴地、极快）→ 中段踢 → 下劈（击倒）；普攻② 后可接膝击（“拖抓”）；跑攻 = 肩撞（学了疾风追击后不击倒，可追加 2~4 击）；跳攻 = 空中踢（之后不能鹰踏） | `FIGHTER_ACTS`（B3） |
| 基础技能（现版 15 个） | 上踢（Z，前半段霸体）、前踢（**按住↑**+Z）、下段踢（按住↓+Z，打倒地 + 冲击波）、膝击（按住→+Z，**抓取**，抓住时自己无敌）、分身（诱饵召唤）、疾风追击 / 疾风连击、钢筋铁骨、瞬步、鹰踏（空中踩 2 次）、念气波、抛沙（失明）、蹲伏（↓↓+C）、金刚碎、旋风腿（原地旋转，可按 C 接空中技）。偷师技能（雷霆膝击 / 肘击 / 折颈 / 毒瓶）**已全部删除** | B3；普攻取消例外：念气波只有气功、抛沙只有街霸、旋风腿只有散打能在普攻中取消 |

### 2.2 武器（5 类，都只改速度 / 距离 / 数值，**不改普攻动作** → 只画在手上）
| 武器 | key / 代码（建议） | 手感 | 限制 |
|---|---|---|---|
| 手套 | `knuckle` / `kn` | 最快、最短、魔攻最高、带施放速度（气功推荐；不装武器按手套算） | — |
| 拳套 | `boxing` / `bx` | 很快、短、物攻高；散打技能冷却 −10% | **只有散打能装备**（要加 `WTYPES.boxing.jobs = ['striker']`，§1 #26a） |
| 爪 | `claw` / `cl` | 普通速度、**距离长**、硬直率高（街霸推荐） | — |
| 东方棍 | `tonfa` / `tf` | 快、较长、攻击最低、**附带物防** | — |
| 臂铠 | `gauntlet` / `ga` | **慢**、物攻 / 力量最高；物理技能 MP / 冷却变多，**抓取技能不受影响**（柔道推荐） | — |

### 2.3 四个转职（到三觉；技能数含被动）
| 转职（id） | 精通 | 伤害 | 招牌机制 | 一觉 / 二觉 / 三觉（觉醒技） | 技能数 |
|---|---|---|---|---|---|
| 气功师 `nenmaster` | 布甲 | **光属性魔法**（`J.dmgType:'mag'`，智力） | 念气环绕（最多 5 颗念气珠绕身自动打人）；念兽·龙虎啸（永久 BUFF，普攻变 5 段魔法 + 感电）；二觉**风雷能量槽**（≥500 开风雷啸）；念气罩（罩内队友无敌） | 狂虎帝（念兽：审判之金雷虎，骑虎跳 3 次）/ 念皇（月华万象，连按吸怪）/ 归元·气功师（禅意·归一） | 29 |
| 散打 `striker` | 轻甲 | 物理 | **柔化肌肉**（散打技能之间有次数的强制中断 + 增伤，同女漫游“花式枪术”那一类）；霸体护甲 60 s；一觉是**变身型 BUFF** + 双重施放 | 武极（烈焰焚步）/ 极武皇（极武霸皇踢）/ 归元·散打（焚火逐日拳） | 28 |
| 街霸 `brawler` | **重甲** | **魔法百分比**（2021 起；`J.dmgType:'mag'`） | **4 种投掷物装填**（毒瓶 10 / 毒针 10 / 砖块 10 / 罗网 5，自动填充）+ 强化投掷 + 一次扔两个；按敌人身上**异常个数**加伤；锁链大招 | 千手罗汉（天崩地裂）/ 暗街之王（燃火轰天炮）/ 归元·街霸（逆道·幽链之界） | 30 |
| 柔道家 `grappler` | 轻甲 | 物理 | **全是抓取**：抓住时无敌；抓不了的敌人自动改成“抓轰炮”（冲击波 + 无视霸体的强制硬直，打领主靠它）；暴力抓取（范围抓）、滑行抓取、连环抓取；二觉可在指定技能中“预约” | 风林火山（死亡旋律）/ 宗师（一字传承·极义震天破）/ 归元·柔道家（黑震流·山岳崩颓） | 28 |

合计 **130 个技能**（基础 15 + 29 + 28 + 30 + 28）、130 个图标。

### 2.4 引擎需求 → 归属
| 需求 | 用在 | 现状 | 归属 |
|---|---|---|---|
| 抓取 → 摔投完整版：抓住时施放者无敌、抓倒地、范围 / 多目标抓、冲刺滑行抓、空中抓、连续抓、把人当投射物扔（撞人 / 撞地伤害）、方向键选摔向、抓不了的回退钩子 | 膝击、柔道全树、街霸 3 个技能、气功 1 个 | `combat.js:272-300` 只有单体抓，`canGrab` 排除倒地 | **B0-E**（通用框架）→ B7 用 |
| 无视霸体的强制硬直（Hold，对领主缩短） | 抓轰炮、罗网、念之战矛等 | 有 stun / bind / root，没有无视霸体的 | **B0-E** |
| 新指令形态：按住↑+Z（`holdu`）、跑攻中 X、空中 C / 空中 ←→+C、蹲伏状态（受击框压低 + 派生） | 基础、柔道 | `player.js:355,363` 只有 `hold` / `holdd` | **B0-E** |
| 普攻替换 BUFF（龙虎啸：普攻 / 跑攻 / 跳攻全换） | 气功 | `p.acts = C.acts` 固定；鬼剑士有 `swordActs` 挑表 | B0 给 `FIGHTER_ACT_PICK`，B4 用 |
| 次数制柔化 + 双重施放 | 散打 | 花式枪术在 `gun_ranger.js:82-99`（职业文件里） | B5 照抄到自己文件 |
| 多种投掷物装填 / 强化投掷 / 一次扔两个 | 街霸 | 技能 `charges`（G-14 三颗）、HUD 显示颗数 `hud.js:189` | B6 |
| 能量槽 + 环绕体 | 气功 | 召唤框架 `follower` 有，能量槽没有 | B4（HUD 小条由 B4 自己画） |
| 按异常个数加伤 | 街霸 | 14 种异常都有（`bestiary.js:42-47`），缺“按个数查” | B6（一个小 helper） |
| 锁定最强敌人 / 瞬移 / 预约施放 | 三觉、柔道二觉 | 有 `aimAhead` | 各转职块 |
| 分身诱饵、队伍无敌罩（联机同步） | 分身、念气罩 | 召唤框架 + `party_sync.js` | B3 / B4 |
| 骑乘（金雷虎、骑在敌人身上捶） | 气功一觉、街霸 | 没有 | B4 / B6 各自做 |

### 2.5 转职 / 觉醒任务（NPC 和地下城本作都有）
| 转职 | 转职任务（Lv15） | 一觉任务（Lv21） |
|---|---|---|
| 气功师 | 风振 → 莎兰 [火热的念心脏] → 烈焰格拉卡 ×2 → 风振 | 决斗胜点 → 城主宫殿 ×2 → 莎兰 [泪之颜料] → 材料 → 悬空城 ×2 |
| 散打 | 格拉卡操作 ≥70% → 烈焰格拉卡限时 → 单人暗黑雷鸣废墟 | 同上（露珠 / 月下美人 / 黎明颜料） |
| 街霸 | 风振 → 诺顿 [免毒药剂] → 黑色小晶块 → 风振 → 暗黑雷鸣废墟 | 诺顿（代替本作没有的加尔·伊莱丝）→ 材料 → 两个地下城 → 胜点 |
| 柔道家 | 风振 → 诺顿 [椎骨肌肉强化剂] → 牛头硬角 + 蓝色小晶块 → 暗黑雷鸣废墟 | 博肯的四张牌（人类 / 亡者 / 无魂 / 海恕） |
| 二觉 / 三觉 | 走现有通用模板（`quests/job.js` 的 `AWAKEN_MORE`：Lv26 炼狱 ×3 → 极昼；Lv30 第二脊椎 ×2 → 天帷禁地） | — |

低置信（实装时按“国服现版优先、说不清就按 namu”处理）：HP / MP、成长斜率；街霸 Lv45 新连锁技的国服名；臂铠精通的国服名；强拳 / 闪击快打 / 飞燕旋风 / 烈火强踢 / 暴力抓取 / 雷霆念炮 / 雷虎天降 的指令；Z 键踢叫“上踢”还是“后踢”；散打二觉“极武皇 / 霸皇”；男版转职任务步骤（中）。

---

## 3. 美术成本

### 3.1 现有三职业是怎么做出来的
| 步骤 | 工具 | 产出 | 现有规模 |
|---|---|---|---|
| 1 设计定稿 | `sheets.py` | `art/src/<职业>_ref.png`（1024×1536 立绘）、`_parts.png`；选角 `class/<职业>`、插图 `cutin/<职业>` | 每职业 3~4 张 |
| 2 原装动作表 | `sheets2.py`（walk / run / jump / combo / react / skillA / skillB 7 张）+ `combatgen.py` / `<转职>_art.py`（react2、sk1、每转职 1~3 张） | 2048×2048，3×3：第 1 格标准站姿 + 8 帧；走 / 跑按 `poseguide.py` 的步态参考 | 鬼剑士 15 张 / 121 帧，神枪手 16 / 129，魔法师 19 / 153 |
| 3 占位武器版 | `avatar_gen.py wpn` | 同一张表把武器换成纯绿 #00FF00 占位棍（姿势不变） | 每张表再生一次 |
| 4 切帧 + 锚点 | `avatar_frames.py`（→ `spr.json`：`wpn` / `wpn2` 握点和角度、`head` 头部锚点、分割线）、`avatar_hands.py`（副手 `F.oh`）、`avatar_hatcheck.py` | `art/final/spr/<职业>/*.webp`，帧约 150×195（res 1.8） | — |
| 5 时装 | `avatar_gen.py ref`（6 套参考立绘）→ `set`（每张表 × 6 套改图）→ `avatar_frames.py --set` | `spr/<职业>@{academy,festival,sky1,sky2,spring,summer}`，同名帧整套替换；混搭按上 / 下 / 鞋三段拼 | 6 + 表数 × 6（鬼剑士 96 张） |
| 6 配件 / 头饰 | `looks.js` AVATAR_ACC `pos[职业]`、`job_head_art.py` | 帽子 / 发饰 / 眼镜按每帧头部锚点叠加 | 只调位置，不生图 |
| 7 武器 | `weapon_gen.py`（一把一张 1536×1024）→ `avatar_weapons.py` | 每类：普通 + r2/r3/r4 + 通用史诗 2 + 装扮 6 + 具名史诗 13~18 ≈ 28 张 | 15 类 388 张 |
| 8 技能图标 / 特效 / 觉醒插图 / 转职立绘 | `combatgen.py icons/fx`、`<转职>_art.py`、`icons.py`、`fxprep.py`、`job_art.py` | `icon/<技能 id>`、`fx/*`、`cutin/<转职>{,2,3}`、`job/<转职>` | 每转职约 20~30 图标（每表约 12 个）、3 张插图、1 张立绘 |

分层（运行时）：身体帧（原装或时装整套替换 / 混搭三段）→ 身后武器 → 身体 → 身前武器 + 握拳像素盖回 → 头部配件（`head` 锚点）→ 转职外观 `jlUnder / jlOver`（发色、头饰、状态特效）→ 强化光效。特效一律运行时画，帧里不烘焙。

### 3.2 格斗家要的动作帧（按表；帧名前缀 `f`/转职各自前缀，和 SKILLS_OFFICIAL_fighter.md 的“动作清单”对应）
| 表 | 帧 | 说明 |
|---|---|---|
| 通用骨架 | idle（中段拳架）、walk1-8、run1-8、jump1-5、jatk1-2（空中踢）、hit1-3、air、airUp、tumble、bounce、down、getup、tech、held、roll、charge、victory | 约 38 帧。**用鬼剑士同名表当姿势参考**（帧名、时间轴和 BASE_ANIMS 一一对应，动画表不用调）；跑步按 ANIMATION.md §5 一开始就画长步幅 + 第 3/7 帧腾空 |
| 普攻 + 共用姿势 | 快拳、下段踢、中段踢（= 前踢）、下劈；上踢 ×2；肩撞；低蹲；抓住、膝撞；举起、背摔落地；旋转踢 ×2；空中下踏、俯冲飞踢；水平飞踢；单掌推、双掌推；握拳蓄气、结印；双脚跳踏落地、单掌砸地 | 约 23 帧（每个姿势 1~2 帧，前摇 / 收招用插值和缓动补），被基础 + 4 转职的几十个技能共用 |
| 气功师 | 盘腿悬空打坐、骑乘（金雷虎）、单手雷刃刺入（+ 可选 2） | 3~5 |
| 散打 | 肘击突进、贴身膝踢、左右连拳 ×2、突进重拳、俯冲拳 | 6 |
| 街霸 | 上手投掷、侧手甩投、骑乘捶打 ×2、贴地滑铲、挥锁链 ×2、挑衅 | 8 |
| 柔道家 | 空中剪刀腿夹、抡人旋转 ×2、身体压下、后空翻、倒插地面 | 6 |
| 每个动作的前后帧 | 攻击类姿势补起手 / 收招帧（现有职业普攻都是 2~3 帧一段） | 约 +20 |
| 合计 | 约 **110 帧**（鬼剑士 121、神枪手 129、魔法师 153） | 3×3 表约 14 张；4×4 表约 8 张 |

### 3.3 生图次数
| 项 | 老流水线 | 推荐做法 | 推荐次数 |
|---|---|---|---|
| 设计定稿（原装立绘、选角立绘） | 3 | 同，**样图先审**（和鬼剑士站一起的比例、Q 版、拳上占位棒） | 3 |
| 原装动作表 | 14（3×3） | **4×4 一张 15 帧**（2048 图每格 512，帧只要 150×195，分辨率够）；通用表拿鬼剑士的表当姿势参考 | 8 |
| 占位武器版（`wpn`） | 14 | 原装表**直接画拳上的绿色占位棒**，省一整轮（样表不过再回到两步做法） | 0（~8） |
| 时装参考立绘 | 6 | 拿鬼剑士（男）的 6 套时装参考当设计参照，男装对得上 | 6 |
| 时装动作表（含天空套 2 套） | 84（14 × 6） | 4×4 表 × 6 套 | 48 |
| 插图（选角 1 + 职业插图 1 + 转职立绘 4 + 觉醒 12） | 18 | 同 | 18 |
| 转职头饰 | 4 | 同 | 4 |
| 技能图标（130 个，每表 12） | 11 | 同 | 11 |
| 技能特效（念气珠 / 罩 / 冲击波 / 感电 / 火 / 沙 / 碎石） | ~8 | 全部复用 `fx`（`orb` `burst` `pm_bubble` `wave` `dust` `lightning` `flame` `rock` `lava`…）运行时染色；只新画归一的光轮、脚上持续火焰 | 2 |
| 召唤物 / 道具（念兽 3 种、瓶 / 砖 / 网 / 雷 / 桶、锁链） | ~10 | 念兽一种一张条；街霸道具一张表 6 个；锁链一节平铺 + 钩头 | 5 |
| 武器：5 类 × (普通 + r2~r4 + 通用史诗 2) | 30 | 拳上武器体积小，**一张 3 把**（样图先验，手持 1 倍下看得清） | 10 |
| 武器装扮 6 款 × 5 类 | 30 | 同上 | 10 |
| 武器 / 流沙 / 通用史诗图标 | ~5 | 同 | 5 |
| **一期合计** | ≈ 230 | | **≈ 130**（若样表不过、退回两步 3×3：≈ 175） |
| 二期：具名史诗武器约 60 件（每类 ~12）+ 图标 | ~70 | 一把一张（史诗要一眼认得出）/ 一张 3 把 | 40~70 |

分摊到块：B1 ≈ 13（设计 3 + 原装 8 + 选角 / 职业插图 2）、B2 ≈ 83（时装 54 + 头饰 4 + 武器 20 + 图标 5）、B3 ≈ 3、B4 ≈ 10、B5 ≈ 8、B6 ≈ 9、B7 ≈ 7（各转职 = 图标 3 + 觉醒插图 3 + 转职立绘 1 + 自己的特效 / 召唤物）。

### 3.4 推荐流水线（逐段样图 → 主线程审 → 批量）
1. `art/tools/fighter_art.py`（照 `spitfire_art.py`：`ref / sheets / icons / fx / cutin / job / avatar / frames` 子命令，复用 `combatgen` / `sheets2` / `avatar_gen` 的函数，不改它们的表）。
2. **样 1**：原装立绘 + 选角立绘（3 张）→ 审画风 / 比例 / 发型头带（转职后靠发色 + 头饰区分，JOB_VISUALS §5）。
3. **样 2**：一张 4×4（普攻 4 段 + 上踢 + 膝击抓 / 膝撞 + 走路 4 帧）带占位棒 → 切帧 → `WEB=1 node test/animfeel.mjs fighter s1` + `node test/skillshots.mjs fighter` 连拍 → 审（占位棒切得干净、双手锚点、脚底不滑）。
4. **样 3**：同一张表 × 夏日时装 → 审（逐帧对得上、白色衣物抠图、没有烘焙特效）。
5. 批量：原装 8 张（4 路并发）→ 时装 48 张（先做完的表先出时装，流水进行）→ `avatar_frames.py` 全套 → `node test/avatar.mjs` + `node test/jobvisuals.mjs heads`。
6. 不用 `rig.py`（老的部件骨骼，只做美术到位之前的占位模型）。

---

## 4. 并行拆分

顺序：**B0 先做、先合并、先部署**（存档修复）→ B1~B9 各自 worktree 并行 → 主线程合并（冲突只会在 `weapon_art.js` 生成文件、`test/all.sh`、`quick.sh`）→ 基础职业 `ready:true` → 每个转职合并后开 `J.ready`。

| 块 | 做什么 | 拥有的文件（只有它能改） | 生图 | 依赖 |
|---|---|---|---|---|
| **B0 骨架 + 登记 + 存档安全 + 测试脚手架**（无美术，约半天） | §1 所有共享文件的一次性登记（#1 #5-7 #10-12 #15 #19-20 #26-27 #29-30 #36 #44 #48 #50 #53-56）；`CLASSES.fighter` 骨架；引擎钩子（B0-E，§2.4 标 B0-E 的三项）；`J.ready` 开关；测试列表改成读 CLASSES | 所有共享文件（player / combat / entity / save / account / items + 4 处装备判断 / gear / shops / sprites / rig / poses / avatar.js / job.js / towns / duel / 测试列表）；`fighter.js` 初版 | 0 | — |
| **B1 原装人物帧** | 设计定稿、原装全部动作表（基础 + 4 转职，§3.2 的姿势表定死）、切帧、双手 / 头部锚点、`class/fighter`、`cutin/fighter` | `art/tools/fighter_art.py`、`art/final/spr/fighter/`、`art/final/class/fighter`、`cutin/fighter`、art 工具里的 fighter 条目（#58-60） | ~13 | B0（帧名表） |
| **B2 外观** | 6 套时装帧、配件位置（#38）、拳上武器 cover 模式（#37）、5 类武器 + 品级 + 装扮 6 款、武器图标、`JOB_LOOKS` 4 条 + 头饰、路人 | `art/final/spr/fighter@*`、`src/models/avatar.js` 的 cover 段、`looks.js` 的 fighter 位置、`job_looks.js` fighter 段、`job_fx.js` fighter 行、`world.js` 路人行、`weapon_gen.py` / `avatar_weapons.py` 的 5 类、`art/final/weapon/<5 类>*` | ~83 | B0；时装要 B1 的表逐张过审 |
| **B3 基础职业** | 普攻 4 段（按武器手感表 `FIGHTER_FEEL`）、肩撞跑攻 + 疾风追击、跳攻、15 个基础技能（膝击用 B0-E 的抓取）、指令、取消白名单（念气波 / 抛沙 / 旋风腿的转职例外）、分身、光 / 暗抗、基础特效 / 图标、`docs/skills/fighter.json` 基础段、`test/fighter.mjs`；之后负责 combat / player / entity 的改动 | `src/content/classes/fighter.js`（B0 之后）、`art/tools/fighter_base_art.py`、`icon/f_*` | ~3 | B0 |
| **B4 气功师** | 29 个技能到三觉（念气珠环绕、龙虎啸换普攻、风雷能量槽 + HUD 小条、念气罩队伍无敌 + `party_sync`、金雷虎骑乘）、特效 / 图标 / 觉醒插图 3 / 转职立绘、规格、测试 | `fighter_nen.js`（+ `_p1`）、`art/tools/fighter_nen_art.py`、`icon/fn_*`、`cutin/nenmaster*`、`job/nenmaster`、`test/nenmaster.mjs`、`docs/skills/fighter_nen_final.md` | ~10 | B0；帧用 `sprOr` 兜底等 B1 |
| **B5 散打** | 28 个（柔化肌肉次数制 + 增伤、霸体护甲、烈焰焚步变身 BUFF + 双重施放、拳套专属） | `fighter_striker.js`、`fs_*`、`striker` 的插图 / 测试 / 规格 | ~8 | 同上 |
| **B6 街霸** | 30 个（4 种投掷物装填 + 强化投掷 + 一次扔两个、异常个数加伤、锁链、骑乘捶打、魔法职业） | `fighter_brawler.js`、`fb_*`、`brawler` 的… | ~9 | 同上 |
| **B7 柔道家** | 28 个（抓取整树、抓轰炮回退、范围 / 滑行 / 连环抓、二觉预约施放） | `fighter_grappler.js`、`fg_*`、`grappler` 的… | ~7 | 同上；投技框架要 B0-E 先到 |
| **B8 装备 / 任务 / 指南** | `JOB_CHAINS.fighter`、4 条转职任务线 + 觉醒任务台词（`content/quests/fighter.js`）、风振台词；二期具名史诗武器 `epics60_w_fighter.js` + 掉落 + 图标；PLAYER_GUIDE 等文档 | `content/quests/fighter.js`、`quests/job.js` 的 fighter 段、`epics60_w_fighter.js`、`wdesign_fighter.py`、`gear_icons_pink60_fighter.py`、文档 | 二期 40~70 | B0；史诗外观跟 B2 的武器风格 |
| **B9 决斗 / AI / 联机 / 手机** | `DUEL_BASE` / `PVP_JOB`（`pvp_balance.mjs 6 all 4` 自动调到 42~60%）、`fighter_ai.js` 近身 + 抓取 + 投后追击、服务端 `AI_POOL`、组队影子 / 同屏检查、手机指令按钮检查、上线开关 | `duel.js` 的 fighter 行、`fighter_ai.js` 的 fighter 分支、`server/modules/arena.js`、`test/pvp_balance.mjs` | 0 | 骨架 B0；调平衡要 B3~B7 |

### 4.1 B0 必须交出来的东西（其它块才能同时开工）
1. **ORDER 空壳**：`content/classes/fighter.js`、`fighter_nen.js`、`fighter_striker.js`、`fighter_brawler.js`、`fighter_grappler.js`（+ `_p1` 各一，可选）、`content/quests/fighter.js`、`content/items/epics60_w_fighter.js`——之后各块只改自己的文件。
2. **`CLASSES.fighter` 骨架**：`ready:false`、属性、`acts`（4 段普攻占位）、`skills:[] / start / bar / cmds:[] / passives:[]`、`jobs = { nenmaster, striker, brawler, grappler }`（`name / role / armor（布 / 轻 / 重 / 轻）/ dmgType（气功、街霸 'mag'）/ growth / awaken* 名字 / ready:false / skills:[] / anims:{}`）；钩子表 `FIGHTER_HOOKS = { onHit, onHurt, beforeHurt, onCast }` + 分发（照 `sword.js:220-235`）、`FIGHTER_ACT_PICK`（转职 / BUFF 换普攻，照 `swordActs`，龙虎啸要用）、`FIGHTER_FEEL` 按武器的手感表（攻速 / 距离 / 硬直 / 臂铠物理技能 MP·冷却惩罚、抓取除外）。
3. **id 预留表**：技能前缀 `f_ / fn_ / fs_ / fb_ / fg_`（已查：现有前缀里没有）；帧名前缀同；精灵 / 特效名先在 `art/final/spr`、`fx` 查重；转职 id `nenmaster / striker / brawler / grappler`（全局唯一：`JOB_ARMOR`、`JOB_LOOKS`、`cutin/`、`job/` 都按转职 id 查）；武器代码 §2.2。技能 id 按 SKILLS_OFFICIAL_fighter.md 的“本作建议”列定死，转职块引用基础技能（前置、派生）不用等 B3。
4. **动画表契约**：`SPR_ANIMS.fighter` 全部片段名 + `sprOr` 兜底；美术到位前用矢量占位模型（`buildSwordsman` 换色、不拿武器）。
5. **引擎钩子（B0-E）**：① 抓取：抓住期间施放者无敌（`h.grabInvul`）、多目标（`a.grabbed` → 列表 + 兼容旧的单个）、`h.grabDown` 抓倒地、`h.grabAir` 空中抓、`h.grabRange` 范围卷过来、`throwArc(a, t, { dx, h, dur, dir, onLand, onHitOther })` 把人扔出去（落地 / 撞人伤害、弹地）、`h.onGrabFail(a, t)` 抓不了时的回退（柔道抓轰炮）；② 无视霸体的强制硬直 `addStatus(t, 'hold', dur)`（领主 ×0.3）；③ 指令：`holdu`（按住↑）、空中 + C、跑攻中 X、蹲伏状态（受击框压低）。都写单测进 `test/combat.mjs`。之后 combat.js / player.js / entity.js 的改动只由 B3 负责人改（PLAYBOOK §4）。
6. **存档安全**：#19 #20 修掉并部署；`test/fighter.mjs save`：老存档（三职业）读写不变、新建格斗家往返、未知职业角色不丢。
7. **测试脚手架**：测试里写死的职业 / 转职列表改成读 `CLASSES`（跳过 `ready===false`）；`weapons / gear60 / cdr60` 跳过未开放职业的武器类型；`docs/skills/fighter.json` 骨架；`test/fighter_<转职>.mjs` 模板。
8. **开关**：`CLASSES.fighter.ready`、`J.ready`（`ui/job.js` 不显示未开放的转职、选角显示“即将开放”）；服务端 `AI_POOL` 读客户端上报的 ready（或 B9 上线时再加）。

### 4.2 依赖图
```
B0 ──┬─> B1 原装帧 ──(逐张过审)──> B2 时装帧
     │                     └─(帧到位)─> B3~B7 换掉 sprOr 兜底
     ├─> B2 武器 / 配件（不等 B1）
     ├─> B3 基础 ─┐
     ├─> B4 B5 B6 B7（技能 id 已定死，和 B3 同时做）
     ├─> B8 任务 / 文档（二期史诗跟 B2 武器风格）
     └─> B9 骨架 ──(B3~B7 合并后)──> 平衡循环赛 → 排位 AI 池
上线：B0 部署 → B1+B2(原装武器)+B3 → fighter.ready → 每个 B4~B7 合并 → 该转职 J.ready → B2 时装 → B9 平衡 → 进排位 AI 池
```

### 4.3 B0 已交付（2026-09-30，接口速查）
- **开关**：`CLASSES.fighter.ready = false`、4 个转职各自 `J.ready = false`；判断一律用 `clsOpen(cls)` / `jobOpen(J)` / `openClasses()` / `openJobs(cls)`（content/classes/common.js）。开发测试网址加 **`?fighter=1`**（选角能建格斗家、转职窗口 4 个方向、风振挂出武器店、随机决斗能抽到）；测试房间 `?test&cls=fighter&fighter=1&mobs=0`。上线 = 删掉那一项 `ready: false`。
- **存档**（#19 #20，要先部署）：不认识 / 没开放职业的角色原样留在 `save.chars`（`charOpen(c)`，不升级、不改、写回照抄），选角显示“需要更新”、不能进；`cloudSave.localChars()` 不再过滤；排位按上报的职业记（server/modules/arena.js）。
- **文件归属**：`fighter.js`（B3）、`fighter_nen / _striker / _brawler / _grappler.js`（B4~B7，`CLASSES.fighter.jobs.<id>` 已登记：精通 / dmgType / growth / 三次觉醒名 / ready:false / skills:[] / anims:{}）、`content/quests/fighter.js`（B8）、`content/items/epics60_w_fighter.js`（B8 二期）。
- **预留 id**：`FIGHTER_IDS`（130 个技能 id，按 SKILLS_OFFICIAL_fighter.md 定死）= `docs/skills/fighter.json` 的 `_meta.reserved`；武器 `knuckle / boxing（jobs: ['striker']）/ claw / tonfa（defPct 物防）/ gauntlet`。
- **钩子**：`FIGHTER_HOOKS.{onHit, onHurt, beforeHurt, onCast, cancelHook, softCommit}.push(fn)`；`FIGHTER_ACT_PICK.push(p => 动作表 | null)`（龙虎啸换普攻）；`FIGHTER_FEEL[武器] = { reach, stun, physMp, physCd, jobCd }`，普攻表按武器由 `fighterActsFor(F)` 生成；技能写 `grab: true` 不吃臂铠惩罚；职业天生属抗 `C.res`。
- **引擎（B0-E）**：hit 字段 `grabInvul / grabMax / grabRange / grabDown / grabAir（'only' | false）/ onGrabFail(a, t, h)`；`grabsOf(a)`、`throwAll(a, h)`、`throwArc(a, t, { dx, dy, h, dur, dir, other, hit, onHitOther, onLand })`；`addStatus(t, 'hold', 秒)`（无视霸体，领主 ×0.3）；指令 `'holdu'`（按住↑）、空中 C（`['', id, 'jump']` + 技能 `air: true, airOnly: true`）、跑攻中 X（占位跑攻已写 `keyLinks: { attack: 'f_chain' }`）、蹲伏 `fCrouchAct({ dur, hurtH, onX })`（`act.hurtH` 压低受击盒，C 起身）。单测在 `node test/combat.mjs` 最后一段。
- **动画契约**：`SPR_ANIMS.fighter`（content/sprites.js，41 个片段），职业帧名 `f_jab1/2 f_low1/2 f_mid1/2 f_axe1/2 f_shoulder1/2 f_jkick1/2 f_high1/2 f_crouch f_grab f_knee f_lift f_slam f_spin1/2 f_stomp f_dive f_flykick f_palm1/2 f_focus f_seal f_quake f_smash`，没出帧时 `fAnim` 用通用帧兜底；矢量占位 `CLIPS.fighter`。
- **测试**：`node test/fighter.mjs [save,ids,feel,switch,smoke]`（quick.sh g5 / all.sh）；`test/fighter_<转职>.mjs` 模板（各块补本转职的机制测试后加进 quick g2）；测试里的职业 / 转职 / 武器类型列表一律读 CLASSES（test/lib.mjs `openLists()`），开放后自动进列表。
- **留给后面**：组队时队员抓主机的怪（grabDown / grabMax / throwArc 的主机同步，net/coop.js remoteGrab）→ B9；服务端 AI_POOL → B9；武器图 / 图标 / 流沙武器图标 → B2（没开放时测试自动跳过）；HP / MP 暂抄鬼剑士。

### 4.4 B8 一期已交付（2026-09-30，任务 / 台词 / 文档；二期具名史诗 `epics60_w_fighter.js` 还没做）
- **风振的台词**：`quests/job.js` 的 `JOB_CHAINS.fighter`（入门「风拳流大师风振」、「风拳流 第一式 ~ 第六式」、「风拳流 - 出师之战」、转职「拳脚的道路」、一觉「觉醒 - 风的壁垒 / 破壁」）+ `AWAKEN_MORE.fighter`（二觉「风的尽头 / 无相」、三觉通用）。NPC 闲聊台词在 `world/towns.js`（B0 的，没动）。
- **四条转职任务线**（`content/quests/fighter.js`，这个文件自己 defineQuest 并登记 `CLASSES.fighter.jobs.<id>.quests / trial`）：`q_job_nenmaster_1~3`、`q_job_striker_1~3`、`q_job_brawler_1~4`、`q_job_grappler_1~4`。**B4~B7 的转职文件不要写 `quests` / `trial`**（会被这里覆盖）。
- **一觉剧情**：`q_awaken_<转职>_1~2`（Lv21，cond = 已转成这个方向），夹在 `q_awaken_fighter_1` 和 `q_awaken_fighter_2` 之间（后者加了 cond）。映射和与官方的差异见 `SKILLS_OFFICIAL_fighter.md` §8.4。
- **没开放时不生效**：37 个任务全是 `cls: 'fighter'`；老职业角色（包括做完所有前置的 Lv30）看不到、NPC 身上也没有；`J.ready:false` 时转职窗口接不到。
- **测试**：`node test/fighter_quests.mjs [inert,data,chain]`（quick.sh g5 / all.sh）。`test/fighter.mjs smoke` 看风振转职窗口前先把 `q_job_fighter_final` 记成已完成（有了转职试炼之后 `jobAvailable` 要它）。
- **文档**：PLAYER_GUIDE（选职业、导师表、转职表 + 四条任务线、一觉剧情）、dnf_reference §6.2 改成男格斗、SKILLS_OFFICIAL_common §8、SKILLS_OFFICIAL_fighter §8.4、PLAYBOOK。JOB_VISUALS §5（B2）、PVP（B9）、GEAR（二期）留给各自的块。
### 4.5 B3 已交付（2026-09-30，基础职业；逐技能对照 docs/skills/fighter_base_final.md）
- **技能**：15 个基础技能全部实装（`f_` id 同预留表），指令 / 冷却（namu 现版）/ MP（DFO Lv1）按官方；规格 `docs/skills/fighter.json` 13 个主动技能，`skillaudit --compare` 不一致 0。
- **给转职用的接口**：`fNenShot(e, lv, { sc, pierce, dmg, life, speed, hit })`（蓄念炮）；`fighterActsFor(F)` 生成的普攻表里有 `fchain1~4`（疾风追击的追加击），`FIGHTER_ACT_PICK` 换普攻时 `{ ...fighterActsFor(F), atk1: … }` 别丢了它们；`fRing(e, x, y, r, t => hit | null, { skip, zMax })` 圆形范围打击；`fKick(t, o)` 踢腿弧光；`SKILLS.f_knee.act` 可以包一层做柔道家的强化膝击（↑ 跳起 / ↓ 摔地）；蹲伏动作 `links: ['fs_pusher']` 已留好散打铁山靠。
- **取消例外**：技能的 `noForce` 可以写成函数 `p => bool`（引擎 canCancelInto 已支持）：念气波 `jobOf(p) !== 'nenmaster'`、抛沙 `!== 'brawler'`、旋风腿 `!== 'striker'`、分身 `!skLv(p, 'fn_blast')`（气功师学幻影爆碎后能在普攻中放分身）。
- **引擎**（player.js 两处）：noForce 函数；`downJumpCmd`——以 ↓ 结尾的 C 指令（蹲伏 ↓↓+C）优先于后跳 ↓+C。
- **美术**：图标 16 个一张表（`art/tools/fighter_base_art.py icons / iconcut`，1 次生图），特效全部复用 fx；人物动作用矢量占位片段（CLIPS.fighter 补了 highkick / hammer / grab / knee / spinkick / stomp / dive / palm / palm2 / seal / focus / quake），B1 出帧后按 SPR_ANIMS.fighter 自动换。
- **测试**：`node test/fighter.mjs base`（技能放得出 / 打得中 / 冷却 / MP、14 条指令、抓取、疾风追击、取消例外、各技能机制）；`node test/skillshots.mjs fighter` 连拍 `test/shots/skills/fighter-base.jpg`。

### 4.6 B9 已交付（2026-09-30，决斗 / AI / 组队 / 手机 / 上线检查）
- **决斗**（`game/duel.js`，docs/PVP.md §4 / §5）：`DUEL_BASE.fighter` 和鬼剑士同一档（近战），强弱全在 `PVP_JOB`：未转职 `[1.53, 0.6]`、气功师 `[0.32, 1.3]`（伤害之外还有念气罩无敌 / 龙虎啸减伤，所以同时加受到伤害）、散打 0.81、街霸 0.45、柔道家 0.7（§5 新规则后整张表重调）。决斗专属：强制硬直 `hold` 最长 1 秒、结束后 1.5 秒内不能再被 hold，束缚最长 3 秒（`PVP_CTRL`）；格斗家的持续伤害（毒 / 出血 / 感电追加）也乘 `PVP.dmg` 和职业修正。**同一次还按用户要求重做了所有职业的决斗规则**（HP ×1.7 / 90 秒、开局 3 秒倒计时、开局冷却、一级 / 二级浮空保护、二次浮空、时间保护、状态保护、投射物 / 召唤物决斗系数口径统一，PVP.md §5）。
- **AI**（`game/fighter_ai.js` 的 `AI_F_*` / `fBusy` / `fAttack`）：格斗家用整个技能池（`aiKit().pool`，20+ 个主动技能放不下 14 格：要放的技能不在栏上就临时换进空闲 / 冷却中的格子，觉醒格和正在放的不换）；放得少的优先（1/(1+次数)²）+ 偶尔先试这局没放过的；立回距离按转职（气功 190、街霸 140、其余贴身）；贴身抓（对手没有抓取保护时）；投后追击（扔到空中 → 跳起来接鹰踏 / 空绞锤 / 裂石破天，倒地 → 霹雳旋踢 / 下段踢 / 伏虎霸王拳）；跳入放空中技；施放中按方向（抛投 / 浮空凌云踢 ↓ 砸地后接霹雳旋踢、夺命锁 ↑）、再按（鹰踏第二踩、殒灭、疾风闪电）、连打 X（极恶飞锁 / 极义震天破 / 月华万象）；念气罩挡近身招、蹲伏躲飞行道具。
- **排位 AI 池**（`server/modules/arena.js`）：`AI_POOL` 加格斗家 5 种（23 种）；客户端 `arena:join` 带 `pool`（自己这边已开放的“职业:转职”），服务端只从里面抽（`aiPoolOf`），老客户端不带 = 原来 18 种 → **格斗家没开放时不会排到格斗家 AI**。服务端要先部署。
- **组队**（`net/coop.js` 抓取段、新文件 `net/coop_fighter.js`，docs/NETWORK.md「格斗家」）：队员抓主机的怪带 `gd`（抓倒地）/ `gm`（这一下最多抓几个，主机不再先放开前一个）；队员 `throwArc` 扔主机的怪发 `g: 2`（落点 / 高度 / 时长），主机按同一条弧线飞（伤害仍由队员的命中包结算），队友影子重放招式时不再自己扔；影子显示本人的可见 BUFF / 念气珠 / 风雷能量 / 装填数（'p' 消息的 `ff`）；念气罩本来就走 party_sync。
- **手机**（`engine/touch.js`，docs/MOBILE.md）：格斗家的指令在触屏上都有按法（空中 C = 空中再点跳跃、蹲伏 / 前踢 / 鹰踏点技能键、蹲着点攻击 = 肩撞 / 点跳跃 = 起身、跑攻中点攻击 = 疾风追击）；状态键最多 5 个、真正的 Buff 排前面（气功师 5 个 Buff 都放得下，第 5 个在最上面一格的里侧）；气功师风雷能量条在触屏上挪到 BUFF 行下面（原来压住 BUFF 倒计时）。
- **测试**：`node test/fighter_pvp.mjs`（决斗表、AI 用得出各转职全部主动技能 + 招牌技能、抓取公平，约 10 秒）、`node test/mp_fighter.mjs`（组队，约 1 分钟）、`node test/mobile_fighter.mjs [shots]`（手机，约 30 秒）、`node test/fighter_launch.mjs`（上线整条流程，约 40 秒）、`node test/pvp_balance.mjs 20 all`（循环赛默认带 `?fighter=1`；`TUNE_ONLY=fighter` 只调格斗家的数）、`server/test/arena.mjs`（AI 池）。

### 4.7 B2 已交付（2026-09-30，外观；审图 `test/shots/fighter_looks/*.jpg`，`node test/fighter_looks.mjs [shots] [live]`）
- **转职动作片段**：4 个转职 53 个片段全部解析到真帧，B1 的 25 个专属帧全部接上（fnStab = fn_thrust1→2、fsMid = fs_kneekick→f_mid2、fsPunch = fs_dashpunch、新 fsRush = fs_rush1/2（焚火逐日拳的连打左右交替）、fsDive = fs_divepunch、fbFan = fb_sidethrow、fbMount = fb_pound1→2、fgFlip = fg_backflip、新 fgPile = fg_piledrive（裂石破天 / 极义震天破抓着人砸地落地）、fnUp = f_focus→fb_chain1）；其余片段本来就是共用姿势（掌推 / 结印 / 下劈 / 抓 / 旋风腿…），列表见测试输出。
- **转职外观**：`JOB_LOOKS` 4 条（JOB_VISUALS.md 阶段 C）；新字段 `outfit` = 原装马甲换成道服颜色（job_fx.js `JL_OUTFIT_PICK.fighter`，只染原装帧）；头饰 4 件（job_head_art.py：念珠 / 红头带 / 创可贴 / 白头带）。
- **拳上武器 = 按帧重画的手臂层**（2026-09-30 第三版；用户：“要直接重做整个手臂那边的图，而不是贴图上去”）：5 类武器各 6 张 4×4 表（`art/tools/fighter_arms_art.py`：原装 91 个人去掉绿棒按原表分辨率重排成 A~F 六张输入表 → “只把小臂和拳头重画成戴着这件武器、其余不动” → 切回每一帧（缩放照抄原装同名帧、轮廓对齐）→ 和原装逐像素比，变了的、靠近拳头的几块（去掉绑带 / 皮肤）= 手臂层 `art/final/spr/farm_<类型>/<帧>.webp`）。运行时（avatar.js）：身体帧先把两只拳抹掉（`avFists`），再在最上面画这一帧的手臂层（远侧手被身体挡着的部分模型本来就没画；时装 / 混搭一样按脚底锚点对齐）；稀有 / 神器 / 传说和 6 款武器装扮不另生图，手臂层按材质换色（`AV_ARM_TINT`：有颜色的皮革 / 漆换主色，金属 / 白往辅色靠，绑带皮肤描边不动）；+13 / +16 光效把手臂层当一把武器画光晕 / 火花。没有手臂层的类型（以后新加的）退回旧的贴图做法（按拳心 / 前臂方向套武器图，远侧拳按露出来的像素裁）。4 倍对照：`node test/fighter_gloves.mjs`。
- **武器图**：5 类 × 普通 / r2 / r3 / r4 + 6 款武器装扮 = 50 张（`art/tools/fighter_weapons_art.py`：一张表一组 —— 类型家族 4 行、装扮 5 行，共 11 次生图 → 切成 weapons2/<key>.png → `avatar_weapons.py`，新握法 glove / claw / tonfa，大小按拳头高 `FIST_H` / 全长 `LEN`）；图标 `item_w_<类型>` / 流沙 `item_sand_<类型>` / `w_fighter` 从武器图做（`fighter_weapons_art.py icons`，不生图）。具名史诗（`ep_kn/bx/cl/tf/ga_*`，`EP2_CODE` 已登记）是 B8 二期。
- **时装**：6 套 × 91 帧（`art/tools/fighter_looks_art.py ref / sheets / frames`：时装参考 6 张（原装立绘 + 鬼剑士同套参考）+ 每套 6 张 4×4 表（walk 表的走路格和 react 表的受击格拼成一张 walkreact，省 6 次）；缩放照抄原装同名帧的倍数（B1 第二遍按头归一过），位置按轮廓对齐原装，锚点从原装平移）；时装配件（帽子 / 发饰 / 眼镜）写了 `pos.fighter / fighter@`；路人 `CROWD_CLS` 加格斗家（开放后才上街，马甲换色 3 种，`only` 支持跨 0° 的色相区间）。
- **生图**：57 次（头饰 4、武器 11、时装参考 6 + 时装表 36），0 失败。

### 4.6 B8 二期已交付（2026-09-30，装备；审计 docs/FIGHTER_GEAR_AUDIT.md，清单 GEAR.md §10.1「格斗家」）
- **武器**：`epics60_w_fighter.js` 史诗 72 件（每类 1~10 1 件、11~50 每段 2 件含天空之城 / 暗黑城深渊专属、51~60 官方 27 件：Lv55 ×10、T1 ×6、T2 ×5、T3 ×6 时空之门深渊）+ 领主神器 / 粉装 17 件（`monDrop`）；力智双属性（气功师 / 街霸是魔法职业）。
- **外观**：不另画武器图，物品上登记配色 `pal`（拳上武器按类型画 + 换色，渲染层接 `ITEMS[key].pal`），没接之前是 `<类型>_r4` / `_r3`；图标 15 张表（`gear_icons_pink60_fighter.py`，生图 15 次）。
- **异界套装**：4 个转职各一套（雷霆之啸 / 邪灵之息 / 诡秘之地 / 璇龙夺魄，官方异界套的名字和招牌技能），首饰通用图标。
- **系统**：红字默认属性按转职（`mainStatOf(cls, job)`）、装备对比算街霸邪功修炼、拳套只掉给 / 只列给散打（随机史诗 / 随机武器 / 自选礼盒 / 流沙兑换）。
- **测试**：`node test/gear60.mjs jobs`（quick.sh g2）、`content` / `power`（加了转职行和职业持平）、`weapons.mjs`（配色变体）、`cdr60.mjs`（流沙拳套只给散打）。

---

## 5. 风险与要主线程拍板的决定
| # | 决定 | 推荐 | 理由 / 风险 |
|---|---|---|---|
| D1 | 职业 key 用 `fighter` | **用**（progress.js 两张表已经用了） | 和实体标志 `e.fighter`（“格斗者” = 玩家类实体）、`game/fighter_ai.js`、`FighterBrain` 同名，grep 噪音大、容易写错成 `p.fighter`；约定一律 `p.cls === 'fighter'`，文件名全用 `fighter_<转职>.js` |
| D2 | 转职 id / 技能前缀 | `nenmaster / striker / brawler / grappler`；`f_ fn_ fs_ fb_ fg_` | 以后做女格斗家时转职 id 加 `_f` |
| D3 | 存档修复先单独上线 | **先部署 B0（`ready:false`）再开放创建** | 老页面读到格斗家角色会整个丢掉再写回云端 |
| D4 | 分阶段上线 | 基础职业先开，转职做完一个开一个（`J.ready`） | 一天内 4 个转职到三觉很紧；已有转职每个 400~1100 行代码 + 20~30 个图标 |
| D5 | 拳上武器怎么画 | **每帧双手锚点（`wpn` + `wpn2`），占位 = 拳心里一根沿前臂的短绿棒**；手套 / 拳套 / 臂铠 cover 模式包住拳头，爪从指节伸出，东方棍沿前臂 | 一种占位覆盖 5 类；现有双持（`wpn2`、`dual`）直接复用；只加 cover 一个开关 |
| D6 | 5 类武器的 key / 代码 | `knuckle` 手套 `kn`、`boxing` 拳套 `bx`、`claw` 爪 `cl`、`tonfa` 东方棍 `tf`、`gauntlet` 臂铠 `ga`；拳套 `jobs:['striker']` | 和现有 15 类 / 代码不重；key 不带下划线（武器装扮图 key = `<装扮>_<类型>`）；拳套限转职是新规则（#26a） |
| D7 | 时装 6 套（含天空套 2 套）何时做 | 原装帧过审后马上做，争取和基础职业一起上 | 缺时装帧时穿时装只显示原装（不报错），可接受但不好看 |
| D8 | 4×4 表 + 跳过占位轮 | 推荐，样表先验 | 生图 ~175 → ~130；风险：16 格一致性变差，不过就退回 3×3 两步 |
| D9 | 具名史诗武器 | 放二期，一期用通用史诗外观 + 普通 / 稀有 / 神器 / 传说 | 每类 12~18 件 × 5 类 = 60~90 件，量和一个武器块（GEAR_PLAN_60 的 B1a）一样大；一期格斗家刷不到本职业具名史诗武器 |
| D10 | 伤害类型 | 气功师、街霸 `mag`（智力），散打、柔道 `phys`；基础职业 `phys` | 官方现版如此（街霸 2021 起魔法百分比）；影响主属性、装备推荐、`mainStatOf` |
| D11 | 转职方式 | 照本作惯例：Lv15 在风振处选转职 + 经典转职任务线（§2.5），**不**照现版“创建时选” | 和三职业一致；任务线 NPC / 地下城本作都有 |
| D12 | 四维 / HP·MP | 力 7 / 体 7 / 智 4 / 精 4（改掉现在的力 8）；HP / MP 抄鬼剑士 | HP / MP 官方没查到（低置信） |
| D13 | 决斗 / 排位 | 平衡跑到 42~60% 再进排位 AI 池（ALL18 → ALL22） | 服务端要部署 |
| D14 | 版本口径 | 国服现版（偷师技能等已删的不做；和女格斗家不同的以男版为准；低置信项按 namu 现版） | common.md §12 原则 |

---

## 6. 上线清单（launch checklist，B9 2026-09-30；主线程已在 27fea3a 开放 `ready:true`，B9 没有改开关）

开放 = 删掉 `CLASSES.fighter.ready: false` 和 4 个转职各自的 `ready: false`（已做）。**服务端（server/modules/arena.js 的 AI 池）要先于或和客户端一起部署**：老服务端不认 `pool`，照旧抽 18 种（不会出错，只是排不到格斗家 AI）。

### 6.1 已验证（`?fighter=1`，测试见 §4.6）
| 项 | 结果 | 测试 |
|---|---|---|
| 建角色 → 30 级 → 转职（4 个方向）→ 技能 / 三次觉醒 | 真实选角界面建角色、`doJobChange` 转职；气功 / 街霸魔攻高于物攻，散打 / 柔道相反 | `fighter_launch.mjs` |
| 地下城 | 气功师 / 街霸 / 柔道家机器人各自打通格兰之森（A / A / B） | `fighter_launch.mjs` |
| 决斗 | 散打用自己的技能栏打完一局；公正属性（Lv30、HP 21000、无装备特效）；23 种职业 / 转职循环赛 20 场 / 对全部在 42~60%（PVP.md §4） | `fighter_launch.mjs`、`pvp_balance.mjs 20 all` |
| 决斗 AI | 4 个转职的全部主动技能都会用（含霹雳旋踢、鹰踏 / 空绞锤 / 裂石破天）；抓取保护内不会被再抓、hold ≤ 1 秒 | `fighter_pvp.mjs` |
| 排位 AI 池 | 上报只开放格斗家 → AI 都是格斗家；不带 pool → 18 种；排位按上报的职业记 | `server/test/arena.mjs` |
| 存档 | 刷新后原样；**没开放的版本**读到格斗家角色：原样保留、选角“需要更新”、写回一字不改；新建角色“即将开放” | `fighter_launch.mjs`、`fighter.mjs save` |
| 组队 | 队员（柔道家）抓 / 扔主机的怪：主机挂到影子上、飞到同一落点（误差 0px）；抓倒地 / 多抓；可见 BUFF / 念气珠 / 装填同步；念气罩；一起通关击杀数一致、无报错 | `mp_fighter.mjs` |
| 手机 | 4 个转职按键不出屏不重叠、状态键（气功 5 个 Buff）、空中 C / 蹲伏 / 前踢 / 鹰踏 / 跑攻中 X、装填角标、风雷能量条位置 | `mobile_fighter.mjs` |

### 6.2 还没做 / 要主线程拍板（按上线影响排）
| # | 缺口 | 影响 | 归属 |
|---|---|---|---|
| G1 | ~~外观~~：B2 已合并（转职动作 / 外观 / 头饰、拳上武器 50 张、6 套时装、路人，§4.7）；上线前主线程看一眼 `test/shots/fighter_looks/*.jpg` | — | B2（已交付） |
| G2 | 具名史诗武器（`epics60_w_fighter.js` 还是空壳） | 格斗家刷不到本职业具名史诗武器（通用史诗 / 普通—传说能用） | B8 二期 |
| G3 | skillaudit 规格：街霸 20 个、柔道家 19 个技能没写规格（`docs/skills/fighter.json`）；气功师 `fn_blast` 段数 1 项不一致（规格 [1,3]，实测 6；原因没查，B9 没动这部分代码）；`all.sh` 还没有格斗家的 `skillaudit --compare` 行 | 数值没和官方逐项对照 | B6 / B7 / B4 |
| G4 | 街霸的决斗专属规则（罗网强化只拉倒地 / 空中、伏虎霸王拳只抓倒地、砖块对罗网目标眩晕减半）没做 | 现在靠 B9 的通用上限（hold 1 秒、束缚 3 秒、持续伤害吃 PvP 系数）+ PVP_JOB 0.45 压住，胜率在区间内 | B6（可选） |
| G5 | 柔道家版金刚碎（肘击砸地、对倒地更高）没做，只加了“收招接霹雳旋踢” | 小差异 | B3 |
| G6 | HP / MP 成长抄鬼剑士（官方没查到）；决斗 `DUEL_BASE.fighter` 也按鬼剑士 | 低置信，平衡靠 PVP_JOB | — |
| G7 | ~~决斗长连段~~：已加时间保护（连续不能行动 7 秒后下一下脱出，PVP.md §5），最长连招从 20.8 秒降到 ~8 秒 | — | 已处理（B9） |
| G8 | `test/mobile.mjs` 的 `up()` 用 CDP `touchEnd` 时列的是“剩下的手指”，实际松开的是列出来的那些（双指用例里松攻击键会把摇杆松掉），它的双指检查可能是碰巧通过；`mobile_fighter.mjs` 用的是正确写法 | 只影响测试可信度 | 手机组 |
| G9 | 开放后排位 AI 局会抽到格斗家；改了格斗家的技能 / AI / 全局 PvP 规则后要重跑 `node test/pvp_balance.mjs 20 all`（循环赛一直带着 `?fighter=1`，开放前后都一样） | — | 主线程 |
