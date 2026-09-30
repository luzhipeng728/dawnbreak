# 新职业计划 · 男圣职者（`priest`）

> 用户目标（2026-09-30，主线程定稿）：照男格斗家的做法加 **男圣职者**：基础职业 + 圣骑士 / 蓝拳圣使 / 驱魔师 / 复仇者，4 个转职做到三觉，官方现版技能和外观，放进本作 **Lv60 体系**（和其他职业一样：官方现版技能压进 Lv1~60，一 / 二 / 三觉按 21 / 27 / 30 解锁）。
> **Lv.115 迁移不做**（外部智能体的“提高等级上限”方案已否决，别动 `MAX_LVL`）。巨兵（十字架 / 念珠 / 图腾 / 镰刀 / 战斧）是**拿在手上的武器**，走鬼剑士 / 魔法师那套手持武器图 + `wpn` 握点，不用格斗家的“手臂层”。
> 做法照 `docs/CLASS_PLAN_FIGHTER.md`（接入点清单、B0 交付、开关、测试读 CLASSES），这里只写**和格斗家不一样的地方**。外部智能体的 `docs/HANDOFF_PRIEST.md` / `SKILLS_OFFICIAL_priest.md` 只留作参考（基础技能表、Lv115 口径都已作废，以本文 + `docs/skills/priest_base_final.md` 为准）。
> 状态：**P-core（本文 + B0 骨架 + 基础职业）已交付**（§4.1 / §4.2）；转职 / 美术 / 装备任务 / 决斗联机按 §4 分块并行。

---

## 0. 结论

| 项 | 结论 |
|---|---|
| 能不能照抄格斗家的接法 | 能，而且大部分接入点已经通用（格斗家 B0 把测试列表、存档、开关都改成读 `CLASSES`）。圣职者 B0 只剩**一次性登记**（§1），没有要重构的地方 |
| 存档 | 已通用：没开放 / 不认识职业的角色原样保留（`save.js charOpen`），`test/priest.mjs switch` 验过（`test/fighter.mjs save` 本来就拿 `priest` 当“未知职业”的样本，现在它是 ready:false，结果不变） |
| 开关 | `CLASSES.priest.ready = false`、4 个 `J.ready = false`；开发测试 **`?priest=1`**（或 `?dev=priest`）只开放圣职者（`?fighter=1` 从“全部强制开放”改成“只开放格斗家”，见 common.js `DEV_OPEN`）。上线 = 删掉那几项 `ready: false` |
| 导师 | **歌兰蒂斯**（本作已有，赫顿玛尔市政街 · 大圣堂，`grandis`）：加了 `job` 服务 + `jobFor: 'priest'`；圣职者开放后挂出“大圣堂的巨兵库”（`shop:grandis`） |
| 武器 | 5 种巨兵，手持；不改普攻动作，只改攻速 / 距离 / 硬直（`PRIEST_FEEL`）；**不装武器按十字架算** |
| 防具精通 | 转职前 **重甲**（已有 `CLASS_ARMOR.priest`）；圣骑士 **板甲**、蓝拳圣使 **轻甲**、驱魔师 **板甲**（现版驱魔物理 / 魔法合一、主流物理战斧；旧版物理板甲 / 魔法布甲）、复仇者 **重甲**（namu 精通页 + 国服资料站） |
| 伤害类型 | 基础物理；圣骑士 `mag`（技能多为独立攻击 `indep`，官方“圣骑士攻击力”）；蓝拳 / 驱魔 `phys`；复仇者 `mag`（暗） |
| 队伍原语 | 大部分已有（`net/party_sync.js`：全队 BUFF / 护盾 / 回复 / 净化 / 复活 / 光环）；B0 补了 3 个：**持续回复** BUFF `hot`、**免死一次** BUFF `life`、**单体施放** `d.to` + `partyPick`（§4.1） |
| 规模 | 技能：基础 11 + 圣骑士约 32 + 蓝拳约 30 + 驱魔约 26 + 复仇者约 30 ≈ **130**（官方现版 KR 2026，§2.3）；动作帧约 110 帧 ×7 套；生图约 130 次（照格斗家的推荐做法，§3） |

## 1. 接入点（格斗家 B0 之后还剩下的职业专属项）

“已做” = P-core 这次改了；其余标了归属块（§4）。行号见格斗家计划 §1，这里只列要动的。

| 位置 | 要做什么 | 状态 / 块 |
|---|---|---|
| `src/ORDER` | `priest.js` + 4 个转职空壳（放在格斗家后面，要用 `CLIPS.fighter` / `POSE.f*` 当占位姿势）、`quests/priest.js`、`items/epics60_w_priest.js` 空壳 | 已做 |
| `content/classes/common.js` | 开关改成按职业（`DEV_OPEN` Set、`jobOpen(J, cls)`、`devOpenParams(q)`） | 已做 |
| `game/items.js` WTYPES / `CLASS_START_WEAPON` | 5 种巨兵（`cross / rosary / totem / scythe / battleaxe`），初始十字架 | 已做 |
| `content/items/gear.js` WEAPON_NAMES | 5 种的品级名（本作原创；官方名 `OFFICIAL_NAMES` 归装备块） | 已做 / P-gear |
| `content/items/shops.js`、`world/towns.js`、`ui/job.js` | 歌兰蒂斯的商店 / 转职、`JOB_MENTOR.priest` | 已做 |
| `game/progress.js` | 四维 6/4/6/6（国服官网，已有）、转职精通写在 `J.armor` | 已有 / 已做 |
| `game/duel.js`、`game/fighter_ai.js` | `DUEL_BASE.priest`、`PVP_JOB['priest:']` 占位；AI 当近战 | 已做（占位）/ P-duel 调平衡 |
| `content/sprites.js`、`engine/rig.js` | `SPR_ANIMS.priest` 契约（§3）；写死的 `['sword','gun','mage','fighter']` 改成读动画表（`SPR_PLAYER_CLS`）、`nameAllPoses` 读全部 `CLIPS` | 已做 |
| `models/models.js` | 占位模型的巨型十字架 `weapon: 'cross'`（`drawGiantCross`） | 已做 |
| `engine/entity.js`、`combat.js`、`game.js`、`player.js`、`net/party_sync.js` | `tickHot` / `lifeSave` / `d.to` | 已做（§4.1） |
| `test/skillaudit.mjs`、`skillshots.mjs` | 网址带 `&<职业>=1`（没开放的职业也能体检） | 已做 |
| `server/modules/arena.js` | `AI_POOL.priest` + **`LEGACY` 也要排除 priest**（否则老客户端会排到圣职者 AI；外部智能体的分支漏了这点） | P-duel（服务端要先部署） |
| `models/avatar.js` AVATAR_CLS、`avatar/looks.js` 配件 `pos.priest`、`job_looks.js` 4 条、`models/job_fx.js`、`game/world.js` CROWD_CLS | 出帧后再加（没有帧时加了会找不到锚点） | P-art |
| `art/tools`（sheets2 / combatgen HOLD / frames HEIGHT / avatar_gen / avatar_frames / weapon_gen / avatar_weapons HAND / 图标） | 加 priest，巨兵 5 类的设计 / 手持比例 / 图标 | P-art |
| `quests/job.js` JOB_CHAINS / AWAKEN_MORE、`quests/priest.js` | 歌兰蒂斯的入门 / 转职任务 / 觉醒台词（没有 `JOB_CHAINS.priest` 时 Lv15 直接转职） | P-gear |
| `net/coop_priest.js`（新）、`engine/touch.js` | 队友影子显示可见状态（恶魔能量 / 魔化 / 意念驱动区域 / 圣力层数）；手机指令检查 | P-duel |
| 文档 | PLAYER_GUIDE（选职业 / 导师 / 转职表）、dnf_reference、SKILLS_OFFICIAL_common §8、JOB_VISUALS、PVP、GEAR | 各块 |

## 2. 官方设计摘要（来源：namu 2026 各技能页、wiki.dfo.world 技能页、国服官网 2020 三觉专题、国服资料站；逐技能对照见 `docs/skills/priest_base_final.md`）

### 2.1 基础职业（现版 11 个技能，全部已实装）
普攻 巨兵 3 连击；跑攻 滑步猛击（接勾拳追击）。偷师 / 旧版的 武器祝福、天使祝福、强制-xx 都已删除。

| 技能 | 指令 | 官方 Lv → 本作 | 冷却 | 要点 |
|---|---|---|---|---|
| 空斩打 `p_launcher` | Z | 1 | 2 s | 身前挑空、身后砸倒，全程霸体；圣骑士独立攻击、驱魔师可蓄力 |
| 虎袭 `p_smasher` | →↓+Z | 1 | 5 s | 抓取冲刺后扔出，冲刺中 X 立即扔 +20% |
| 直拳冲击 `p_lucky` | →+Z | 5 | 3 s | 3 拳，末击暴击 +20%；只有蓝拳能取消普攻 |
| 勾拳追击 `p_second` | 跑攻中 X | 10 | 2 s | 上勾拳挑空，霸体 |
| 缓慢愈合 `p_slowheal` | →+Space | 5 | 10 s | 单体 20 秒持续回复（体力加成） |
| 净化 `p_cure` | ↓↓+Space | 10 | 15 s | 全队解除 5 种异常 |
| 恶魔之手 `p_grab` | ↓→+Z | 10 | 6 s | 暗魔法 2 段 + 束缚；圣骑士学不了 |
| 纯白之刃 `p_purity` | ↑→+Z | 15 | 2 s | 光属性独立攻击；只有圣骑士 |
| 落凤锤 `p_phoenix` | ↑↓+Z | 15 | 6 s | 跳起插地冲击波；驱魔强化 / 可取消普攻 |
| 化魔 `p_rapture` | ↓→+C | 15 | 8 s | HP 换 MP；复仇者改写；圣骑士学不了 |
| 升天阵 `p_emblem` | ↓↑+Z | 20 → 16 | 5 s | 光魔法法阵挑空；只有驱魔能取消普攻 |

### 2.2 武器（namu 排名，巨兵手持，不改动作）
| 武器 | key / 代码 | 物攻 / 魔攻 / 攻速 | 距离 | 特点 | 推荐 |
|---|---|---|---|---|---|
| 十字架 | `cross` / `cr` | 4 / 3 / 3 | 中 | 唯一带体力 / 精神 / 双防；施放 +2%；不装武器按它算 | 圣骑士 |
| 念珠 | `rosary` / `ro` | 5 / 1 / 4 | 短 | 魔暴 +2%、施放 +5% | 驱魔（魔） |
| 图腾 | `totem` / `tt` | 2 / 4 / 2 | 较短 | 力量最高、命中 +1% | 蓝拳 |
| 镰刀 | `scythe` / `sc` | 3 / 2 / 1 | 很长 | 物暴 + 魔暴、命中 −1%、硬直小 | 复仇者 |
| 战斧 | `battleaxe` / `ba` | 1 / 5 / 4 | 很长 | 命中 +2%、硬直大 | 驱魔（物） |

### 2.3 四个转职（现版 KR 2026 技能树；觉醒名用国服官网 / 资料站）
| 转职（id / 前缀） | 精通 / 伤害 | 一觉 → 二觉 → 三觉（觉醒技） | 招牌机制 → 引擎落点 | 技能数 |
|---|---|---|---|---|
| 圣骑士 `crusader` / `pc_` | 板甲 / 独立攻击（`mag`） | 天启者（天启之珠）→ 神思者（神圣洗礼：信仰之翼）→ 神启·圣骑士（生命礼赞：神威，联动一 / 二觉） | 全队祝福（荣誉祝福 / 守护徽章 / 信念光环）→ `partyCast('buff')` / `partyAura`；单体治疗 / 护盾 → `d.to` + `hot` / `shield`；生命源泉（复活）→ BUFF `life` + `revive`；圣愈之风 / 圣佑结界 → `heal` + `cleanse`；圣光沁盾（挡子弹的墙）→ 召唤框架 field + 投射物判定（块内做）；圣力层数（最多 5）、神罚之锤换普攻 → `PRIEST_ACT_PICK`；灵魂牺牲（死亡时全队回复）→ `onDeath` 包一层 | ~32 |
| 蓝拳圣使 `monk` / `pi_` | 轻甲 / 物理 | 神之手（泯灭神击）→ 正义仲裁者（制裁：怒火疾风）→ 神启·蓝拳圣使（正义执行：雷米迪奥斯的圣座） | **意念驱动**（巨兵插地的光环区域，大部分技能要它；普攻变拳 → `PRIEST_ACT_PICK`；空斩打 / 落凤锤不能用 → `PRIEST_HOOKS.req`）；俯冲 / 摆动（短无敌闪避）；神圣反击（祈祷中受击反击，减伤 90% → `beforeHurt`）；干涸之泉（技能互相取消 → `cancelHook`）；幻影化身（分身追击 → 召唤框架）；直拳冲击可取消普攻（已做） | ~30 |
| 驱魔师 `exorcist` / `pe_` | 板甲 / 物理（2024 起物魔合一） | 龙斗士（KR 사좌천태문，国服名待查）→ 真龙星君（真龙焚天）→ 神启·驱魔师（雷鸣怒海·火啸山崩） | **式神**（朱雀 / 玄武 / 白虎 / 苍龙 / 黄龙，脚本化召唤 → `game/summon.js` field / attach）；玄武强制硬直 → `addStatus(t,'hold')`；黄龙全队加速 → `partyCast('buff')`；蓄力 → `act.charge`；落凤锤 / 升天阵强化、可取消普攻、落凤锤后接物理技能 → `PRIEST_HOOKS.mod` / `cancelHook`（`noForce` 已按驱魔写好）；空斩打蓄力 → 包一层 `SKILLS.p_launcher.act` | ~26 |
| 复仇者 `avenger` / `pa_` | 重甲 / 暗魔法（`mag`） | 末日审判者（魔化：末日审判者，变身 50 秒）→ 永生者（永堕：混沌弑神）→ 神启·复仇者（末日福音：毁灭之翼） | **恶魔能量槽**（上限 400，HUD 小条块内画，照气功风雷能量）；半魔化 / 魔化（变身：换普攻 → `PRIEST_ACT_PICK`，换技能 → `S.morph`，霸体）；恶魔屏障（减伤 60%）→ `beforeHurt`；恶之再临（免死回人形）→ BUFF `life`；处刑 / 黑暗之触（抓取）→ 格斗家 B0-E 抓取框架；化魔改写（自动施放 / 能量）→ `onCast`；镰刀精通光抗 − 暗抗 + → `C.res` 按转职 | ~30 |

等级：官方学习等级按 common §7 压缩（≤15 不变，否则 `round(15 + (官方 − 15) × 15/85)`）：转职 15、一觉技 21（官方 45~50）、二觉技 27（80~85）、三觉 29~30（92~100）。三觉的“联动觉醒”（和一 / 二觉共用冷却、效果随联动变）各块自己做。

## 3. 动画片段契约 / 美术

- **片段名**（`SPR_ANIMS.priest`，content/sprites.js；帧名一律 `p_` 前缀，没出帧时自动用通用帧兜底，出了第一帧整条换）：
  `atk1 [p_a1_1, p_a1_2]`、`atk2 [p_a2_1, p_a2_2]`、`atk3 [p_a3_1, p_a3_2]`（重砸）、`dash [p_dash1, p_dash2]`、`jatk [p_jatk1, p_jatk2]`、`up [p_up1, p_up2]`（空斩打）、`upper [p_jab1, p_upper]`、`grab [p_grab]`、`carry [p_carry]`、`throw [p_carry, p_throw]`、`jab [p_jab1, p_jab2]`、`straight [p_jab1, p_straight]`、`pray [p_pray]`（治疗 / BUFF 通用）、`cast [p_cast]`（施法手势）、`cross [p_cross1, p_cross2]`、`leap [p_leap]`、`thrust [p_leap, p_thrust]`（插地）、`rapture [p_rapture]`；通用骨架帧和鬼剑士同名（`BASE_ANIMS`）。转职的帧用 `pc_ / pi_ / pe_ / pa_` 前缀写进 `J.anims`（sprites.js 自动并入）。
- **矢量占位**：`CLIPS.priest`（鬼剑士骨架 + 格斗家的拳 / 结印姿势 + 巨型十字架），美术到位前就能玩、能测。
- **武器 = 手持巨兵**：原装表里画纯绿占位棒，切帧记 `wpn` 握点（和鬼剑士 / 魔法师一样，`avatar_gen.py wpn` → `avatar_frames.py`）；蓝拳意念驱动 / 复仇者徒手的帧照样记握点（巨兵不画）——武器 5 类 × (普通 + r2~r4 + 通用史诗 2 + 装扮 6) 走 `weapon_gen.py` 一把一张（PLAYBOOK §2.5）。
- **生图预算（照格斗家推荐做法）**：设计定稿 3 + 原装 4×4 表 8 + 时装参考 6 + 时装表 48 + 插图（选角 / 职业 / 转职立绘 4 / 觉醒 12）18 + 转职头饰 4 + 技能图标 11 + 特效 / 召唤物（式神 5、墙 / 锁链 / 能量）约 8 + 武器 5 类约 20 + 图标 5 ≈ **130 次**；二期具名史诗约 60 件（每类 12）40~70 次。基础职业图标已做（1 次）。

## 4. 分块（P-core 之后并行；每块自己的文件，共享文件只由 P-core 改过的这些）

| 块 | 做什么 | 拥有的文件 | 生图 | 依赖 |
|---|---|---|---|---|
| **P-core**（已交付） | 本计划、B0 登记 / 开关 / 队伍原语 / 动画契约、基础职业 11 技能 + 普攻、规格、测试、图标 | `priest.js`、`docs/skills/priest.json` 基础段、`priest_base_final.md`、`test/priest.mjs`、`art/tools/priest_base_art.py`、§1 标“已做”的共享文件 | 1 | — |
| **P-art** 人物 + 外观 | 设计定稿、原装 4×4 表（基础 + 4 转职的专属姿势）、切帧 / 握点 / 头部锚点、6 套时装、配件位置、`JOB_LOOKS` 4 条 + 头饰、路人、选角 / 职业插图；5 类巨兵 + 装扮 + 图标 | `art/tools/priest_art.py`（照 fighter_art / fighter_looks_art）、`art/final/spr/priest*`、avatar / looks / job_looks / job_fx / world 的 priest 行、`weapon_gen.py` / `avatar_weapons.py` 的 5 类 | ~100 | P-core（帧名表） |
| **P-crusader / P-monk / P-exorcist / P-avenger** | 各自技能到三觉、机制（§2.3）、特效 / 图标 / 觉醒插图 3 / 转职立绘、`docs/skills/priest.json` 自己的段 + `priest_<转职>_final.md`、`test/priest_<转职>.mjs` | `priest_<转职>.js`（+ `_p1`）、`icon/<前缀>*`、`cutin/<转职>*`、`job/<转职>` | 各 ~8 | P-core；帧用 sprOr 兜底等 P-art |
| **P-gear** 装备 / 任务 / 指南 | `JOB_CHAINS.priest` + 4 条转职任务线 + 觉醒台词（歌兰蒂斯）、官方武器名、具名史诗 `epics60_w_priest.js` + 掉落 / 深渊登记 + 图标、异界套装、文档 | `quests/priest.js`、`quests/job.js` 的 priest 段、`epics60_w_priest.js`、GEAR / PLAYER_GUIDE | 二期 40~70 | P-core；史诗外观跟 P-art 的武器风格 |
| **P-duel** 决斗 / AI / 联机 / 手机 / 上线 | `DUEL_BASE` / `PVP_JOB`（`pvp_balance.mjs` 循环赛，循环赛网址要加 `priest=1`）、`fighter_ai.js` 圣职者分支（圣骑士 BUFF / 治疗时机、蓝拳贴身、驱魔中距离、复仇者变身）、服务端 `AI_POOL` + `LEGACY`、`net/coop_priest.js`、手机按键、上线清单 | `duel.js` 的 priest 行、`fighter_ai.js` 的 priest 分支、`server/modules/arena.js`、`net/coop_priest.js` | 0 | 转职块合并后调平衡 |

上线顺序：P-core（ready:false，可以直接部署）→ P-art 原装帧 + 武器 → `CLASSES.priest.ready` → 每个转职合并后开 `J.ready` → 时装 → P-duel 平衡 → 进排位 AI 池（服务端先部署）。

### 4.1 B0 交付的接口（给转职块）
- **开关**：`clsOpen / jobOpen(J, cls) / openClasses / openJobs`；开发网址 `?priest=1` / `?dev=priest`（测试房间 `?test&cls=priest&priest=1&mobs=0`）；`devOpenParams(q)` 把本页的开放开关带到跳转网址。
- **登记**：`CLASSES.priest.jobs.<id>` 已有 `name / role / armor / dmgType / growth / awakenName{,2,3} / ready:false / desc / skills:[] / anims:{}`——转职块 `skills.push(...)`、`Object.assign(J.anims, ...)`、设 `J.awaken{,2,3}`（觉醒技 id 用 `PRIEST_IDS.awaken`）。
- **预留 id**：`PRIEST_IDS`（前缀 `p_ pc_ pi_ pe_ pa_`；**`pm_` 被协战师占了，蓝拳用 `pi_` = Infighter**；武器代码 `cr ro tt sc ba`；觉醒技 `<前缀>awaken{,2,3}`）。
- **钩子**：`PRIEST_HOOKS.{onHit, onHurt, beforeHurt, onCast, cancelHook, softCommit, req, mod}.push(fn)`；`req(p, id) → true | 提示`（基础技能统一挂了 `pReq(id)`）；`mod(p, id) → { dmg, range, type, jump, pull }`（基础技能都读 `pMod`：圣骑士 `type: 'indep'`、驱魔 `dmg: 1.2, range: 1.2, jump`、升天阵 `pull`）；`PRIEST_ACT_PICK.push(p => 动作表 | null)`（换普攻，展开 `priestActsFor(pFeelOf(p))` 再覆盖）；`PRIEST_FEEL[武器] = { reach, stun }`；`pBoxHit(e, box, h, skip)`。
- **取消例外**：技能 `noForce: p => jobOf(p) !== '<转职>'`（直拳冲击 = 蓝拳、升天阵 / 落凤锤 = 驱魔）；转职限制 `only` / `excl`（纯白之刃只有圣骑士；恶魔之手 / 化魔 / 升天阵圣骑士学不了）。
- **队伍原语**（`net/party_sync.js`、`engine/entity.js`，组队走中继、决斗 / AI 只作用在施放者身上）：
  - `partyCast('buff', { id, to?, b: { t, atk, aspd, cspd, mspd, crit, dmg, taken, hpPct, mpPct, sa, inv, hot, life, name, col }, aura? }, 施放者)`；`hot` = 每秒回复最大 HP 的比例（`tickHot` 每秒结算、飘绿字），`life` = 免死一次、回复到这个比例（`lifeSave`，killEnt 开头，决斗里不生效）
  - `partyCast('shield', { id, to?, pct | v, t, cap })`（吸收护盾）、`'heal' { to?, pct | v, mp }`、`'cleanse' { n }`、`'revive' { uid }`；`partyAura(job, fn)`（光环）
  - `d.to` = 目标 uid（`partyMyUid()`；单机 0），`partyPick(src, r)` → `{ t, to }`（r 以内 HP 比例最低的队员，单刷是自己）
- **测试**：`node test/priest.mjs [switch,ids,party,base,smoke]`（quick.sh g5 / all.sh）；`node test/skillaudit.mjs priest[:<转职>] --compare`（all.sh `audit_priest`）；`node test/skillshots.mjs priest`。转职块写 `test/priest_<转职>.mjs`（affected.mjs 按文件名自动挑）。

### 4.2 基础职业交付（逐技能见 `docs/skills/priest_base_final.md`）
- 11 个技能 + 普攻 3 连 / 跑攻 / 跳攻全部实装；指令 / 冷却 / MP / 学习等级按官方；`skillaudit --compare` 不一致 0。
- 给转职用：`pSmashThrow`（虎袭扔人）、`pHealPct`（缓慢愈合回复量）、`P_RAPTURE`（化魔参数，复仇者改写时读它）、`pRaptureTick`。
- 图标：12 个一张表（`art/tools/priest_base_art.py icons / iconcut`，含职业徽记 `p_crest`）。

## 5. 决定 / 待拍板
| # | 问题 | 推荐 |
|---|---|---|
| Q1 | 圣骑士现版分“守护恩赐（纯辅助）/ 勇气恩赐（战斗）”两条互斥路线 | 本作单刷为主：默认战斗路线（自己也吃全队 BUFF），守护恩赐做成可切换的被动（组队时切）；两条都做，P-crusader 决定细节 |
| Q2 | 驱魔一觉技国服名（KR 사좌천태문）没查到 | P-exorcist 查国服客户端 / 官网；查不到用直译“四座天太门” |
| Q3 | HP / MP 成长官方没公开 | 暂按鬼剑士略高（HP 1900 + 155/级、MP 760 + 44/级），决斗强弱靠 PVP_JOB |
| Q4 | 缓慢愈合官方是施放后用方向键选队员 | 本作自动选 HP 比例最低的队员（组队时），单刷给自己；手机上也不用选 |
| Q5 | 纯白之刃官方只有圣骑士 | `only: ['crusader']`：转成别的方向后学不了 / 用不了；没转职时（Lv15 以上、还没去歌兰蒂斯那转职）也能学，和其他职业的 `only` 技能一样 |
