# 破晓地下城 · 战斗与角色动作

本文说明战斗机制（尽量对齐 DNF 国服经典期），以及怎样新增技能、转职和动作帧。代码都在一个全局作用域里（见 `src/ORDER`），下文提到的函数可以直接在任何文件里调用。

## 1. 文件一览

| 文件 | 内容 |
|---|---|
| `src/engine/entity.js` | 实体 `Ent`：状态机、物理、动作推进（时间窗、攻速、蓄力）、动画选择、绘制（受击闪白、霸体红描边、浮空姿态旋转） |
| `src/engine/combat.js` | 战斗结算：命中判定、伤害公式、受击反应（硬直 / 浮空 / 倒地 / 追击）、破招、背击、霸体、抓取、格挡、决斗场保护。常量表 `COMBAT`、`PVP` |
| `src/engine/pad.js` | 虚拟手柄 `Pad`：AI / 网络对手用它按键 |
| `src/engine/proj.js` | 投射物（多段 `rep`、次数上限 `max`、生成时记下伤害类型 / 属性 / 蓄力倍率） |
| `src/engine/fx.js` | 特效：刀光、火花、伤害数字、文字、残影、冲击波、`fxSpr`（通用手绘特效）、`fxBeam`（光束）、`fxCharge`（蓄力光点）、`fxGuard` |
| `src/game/player.js` | 角色（格斗者）逻辑：移动、跑、跳、普攻连段、跑攻、跳攻、后跳、受身、闪避、技能施放与取消、指令输入 |
| `src/game/fighter_ai.js` | 格斗者 AI（决斗场对手） |
| `src/game/duel.js` | 决斗场（PvP 原型） |
| `src/content/classes/common.js` | 技能登记 `defSkill`、转职工具、被动 / BUFF、常用攻击与投射物构件 |
| `src/content/classes/<职业>.js` | 职业普攻与基础技能：`sword.js` `gunner.js` `mage.js` |
| `src/content/classes/<职业>_<转职>.js` | 转职技能：`sword_blade` `sword_berserker` `gun_ranger` `gun_launcher` `mage_elemental` `mage_battle` |
| `src/content/sprites.js` | 逐帧动画表 `SPR_ANIMS`（片段名 → 帧） |
| `art/tools/combatgen.py` | 生成新动作表 / 技能图标表 / 技能特效（gpt-image） |
| `art/tools/frames2.py` `icons.py` `fxprep.py` | 切帧、切图标、处理特效（均支持追加模式） |

坐标：x 横向、y 纵深（0..`DEPTH`=196）、z 高度。逻辑固定 60Hz（`game.js` 的 `step`）。

## 2. 伤害公式

```
伤害 = 攻击力 × 技能倍率 × 防御减免 × 属性修正 × 浮动(±5%)
       × 暴击 × 破招 × 额外伤害 × BUFF 伤害 × 决斗场修正 × 受伤倍率
```

| 项 | 规则 | 位置 |
|---|---|---|
| 攻击力 | 物理 `atk` / 魔法 `matk` / 独立 `indep`（没有就回退 `atk`）。类型取 攻击判定 `type` → 技能 `type` → 职业默认 `dmgType`（鬼剑士、神枪手物理，魔法师魔法，枪炮师技能是独立攻击） | `atkOf` |
| 防御减免 | `1 − 防御 / (防御 + 1200)`；物理 / 独立读 `def`，魔法读 `mdef` | `defOf` |
| 属性修正 | 火冰光暗：`1 + (攻方 elem[e] − 守方 res[e]) / 220`。技能没写属性时用武器属性 `atkElem`。火属性攻击会解除冰冻 | `elemMul` |
| 暴击 | 物理用 `crit`，魔法用 `mcrit`；背击暴击率 +10%；暴击伤害 `critDmg`（默认 ×1.5）+ BUFF | `critOf` |
| 破招 COUNTER | 目标正在出招（攻击判定结束之前，没有判定的动作取前 60%）→ 伤害 ×1.25，硬直 ×1.5 | `isCounter` |
| Miss | Miss 率 = 守方 `evade` − 攻方 `hitRate`（0..0.6）；抓取、觉醒等 `sure` 攻击必中 | `applyHit` |
| 额外伤害 | 装备词条 `dmgUp`、技能 BUFF / 被动的 `dmg` 字段 | |
| 受伤倍率 | 装备 `dmgTaken`、BUFF 的 `taken`（暴走 +10%，燃斗 −10%）；魔法护盾让一部分伤害改扣 MP | |
| 决斗场修正 | 双方都是格斗者时 ×`PVP.dmg`（0.35），技能可用 `pvp` 字段再修正（觉醒 0.45） | |
| Over Kill | 击杀的一击超过目标最大 HP 的 30% 时弹出 | |

## 3. 受击反应

| 机制 | 规则 |
|---|---|
| 硬直 | `stun × 僵直度修正 × 破招 1.5 × 决斗场 0.85 / √体重`；僵直度修正 = clamp(1 + (攻方 `stagger` − 守方 `hardness`) / 250, 0.5, 1.6)。硬直长、击退强或 `heavy` 的攻击播放重受击帧 |
| 打击停顿 | 攻击判定 `hs`（默认 0.06 秒），暴击 +0.02、破招 +0.03；近战攻方也停顿，投射物只停目标 |
| 浮空 | 见 **docs/COMBAT_JUGGLE.md**（`JUGGLE` 参数表）：`launch` 挑空（÷ 重量^0.5，同一轮第 n 次 ×0.87ⁿ），空中普通受击 `airLift`（上升中不打断，下落中按力度接住，越连越接不住），浮空重力 1150、每击 +3%；刷图浮空 5 秒后挑不高、接不住 |
| 落地 | 落地速度 > 330 弹地一次（`spike` 砸地 + `bounce` 可强制弹），然后倒地 |
| 倒地 | 只有 `downHit` 的攻击能打到倒地目标（追击）；没有 `launch` 的追击让目标小弹一下。怪物被追击 4 次后强制起身（0.7 秒无敌）。起身无敌：玩家 1.1 秒 / 怪物 0.55 秒 / 决斗场 0.7 秒 |
| 受身蹲伏 | 倒地后按 C：蹲伏（无敌），按住延长（地下城最长 3 秒 / 决斗 1.5 秒），蹲着可以慢慢挪；松开起身，霸体 0.3 / 0.1 秒；耗 1 MP，冷却 5 / 20 秒 |
| 霸体 | `superArmor`（秒）或动作的 `superArmor: true / [t0,t1]` 时间窗：照常受伤，不硬直不浮空，红色描边 |
| 无敌 | `invul`（秒）或动作的 `invul` 时间窗（后跳起跳 0.22 秒、崩山击落地、觉醒） |
| 抓取 | 攻击判定 `grab: true`：抓住目标（**可以抓霸体和格挡中的目标**），目标进入 `held` 状态，位置由抓取者的 `hold(e,t)` 决定；抓取者动作结束 / 被打断就释放；`throwGrab(e, hit)` 把目标扔出（必中、无视霸体）。领主和 `noGrab`、体重 > 2.2 的目标抓不住 |
| 格挡 | 动作 `guard: 吸收比例`：正面的非抓取攻击只受 (1 − 吸收) 伤害、不硬直、被推开 |
| 背击 | 攻方在目标背后：暴击率 +10%，弹出 BACK ATTACK |

## 4. 决斗场保护（`PVP`，数值参考社区实测）

| 保护 | 规则 |
|---|---|
| 浮空保护 | 本轮浮空累计受到 20% 最大 HP 伤害后加速下落（每级重力 +60%），之后每多 5% 再加重一级，挑空 / 托空力 ×0.55^级；到 35%（第 4 级）强制空中受身（无敌、站着落地）；同一轮浮空超过 3 秒重力每秒再 +80%。目标身上闪蓝光、血条下蓝条 |
| 倒地保护 | 倒地后累计伤害 ≥20% → 强制起身 + 0.7 秒无敌 |
| 平推保护 | 站立挨打累计伤害 ≥22% → 强制击倒 |
| 抓取保护 | 被抓释放后 1.5 秒内不能再被抓 |
| 连击统计清零 | 可行动状态持续 1 秒后清零 |
| 怜悯无敌 | PvE 里玩家被怪物打中有 0.2 秒保护；决斗场里没有 |
| 燃斗模式 | HP ≤25%：攻击 +15%、受到伤害 −10%（每局一次） |
| 其他 | 紧急闪避冷却 ×2、受身蹲伏冷却 20 秒、伤害修正 0.35（再乘技能类型 / 职业修正，见 docs/PVP.md）；连击硬直衰减：每挨一下 −2.5%，最低 60% |

## 5. 动作（act）

动作是一个对象，交给 `e.doAct(def, extra)` 执行。常用字段：

| 字段 | 说明 |
|---|---|
| `name` `clip` `dur` | 名称、动画片段（`SPR_ANIMS` 里的名字）、时长（秒） |
| `hits` | 攻击判定数组：`{ t0, t1, box:[前沿0, 前沿1, 纵深半宽, z0, z1], dmg, type, elem, stun, knock, launch, airLift, down, downHit, spike, bounce, grab, heavy, hs, shake, rep, max, big, col, snd, critBonus, sure, onHit(a,t,dmg), pvp }`。`rep` = 同一目标多段的间隔，`max` = 最多几段，`spike` = 向下砸地，`radial` = 从中心向外击退 |
| `move` | `[[t0, t1, vx, vz?, vy?], ...]` 这段时间内的位移速度（乘朝向与动作速度） |
| `events` | `[{ t, fn(e) }]`（`evAt(t, fn)`、刀光 `slashAt(t, {...})`） |
| `update(e, dt)` `onStart` `onEnd(e, 被打断)` `onLand` | 回调 |
| `onInput(e, pad, dt)` | 动作自己处理输入（流心的 X/C/Z、移动射击、天雷落点、连按追加）；返回 true 则本帧不再处理技能 |
| `superArmor` `invul` | `true` 或时间窗 `[t0,t1]` / `[[t0,t1],...]` |
| `noCounter` `counterEnd` | 不会被破招 / 破招判定结束时间 |
| `speed` | `'aspd'`（攻速，普攻默认）、`'cspd'`（施放速度，技能写 `cast: true`）、数字 |
| `charge` | `{ at, max, min, dmg, clip, update, onRelease(e, k), hold, holdMax, keepRoom, onRoom }`：动作到 `at` 秒后按住技能键蓄力，松开或蓄满继续；`hold` = 蓄满后继续按住保持满蓄（最多 `holdMax` 秒，默认 10）；`keepRoom` = 蓄气中可以带着过门（换房后调 `onRoom(e)`）；`act.chargeK` 0..1，伤害 ×(1 + k × dmg) |
| `keepRoom` `onRoom` `doorPad` | 动作可以带着过门（`true` 或 `fn(e)`，例：魔道学者的载具），换房后调 `onRoom(e)`；`doorPad` 放宽门的判定（车身宽、人到不了墙边） |
| `noAwk` | 这个动作 / 技能不能被觉醒打断（默认都能） |
| `cancelFrom` | 此后可以被技能 / 后跳取消；没有就不能取消（觉醒） |
| `basic` `chain` `next` | 普攻：`chain:[开始, 结束]` 内按 X 接 `next`（字符串或 `p => 名字`）；普攻随时可被技能取消，命中后可被后跳取消 |
| `follow(p)` `followWin` | 追加段（三段斩、双鹰回旋）：窗口内再按同一个键或 Z |
| `guard` `grabAt` `hold(e,t)` `onGrab(e,t)` | 格挡、抓取相关 |
| `airOnly` `lowGrav` | 空中动作、空中重力倍率 |

取消规则（与原作一致）：普攻 → 任何技能（随时）；普攻打出判定后 → 后跳；技能 → 其他技能 / 后跳（`cancelFrom` 之后）；**普攻和大部分技能施放中途都能直接切入觉醒（一 / 二 / 三觉，`awkCancelOk`；空中只能切能在空中放的觉醒，写了 `noAwk` 的除外；决斗场同样适用）**；觉醒本身不能被取消。闪避（Shift / V）可以在站立、普攻中、技能后摇中使用，受击硬直中使用（紧急闪避）冷却更长。

## 6. 输入与控制器

- 角色只通过 `p.pad` 读输入，接口与全局 `input` 相同：`is / hit / up / dx / dy / command / buffered / consume / runDir`。
- 键盘 / 触屏玩家：`pad = input`（`game.step` 每帧调用 `input.frame`）。
- AI / 网络：`pad = new Pad()`，每个逻辑帧先 `pad.hold(a)` / `pad.tap(a)` 写入按键，再 `pad.frame(game.t)` 结算。`aiFighterControl` 就是 `brain.tick → pad.frame → playerControl`。网络对战只要把对方的按键序列写进 `Pad` 即可。
- 技能栏 / 技能等级 / 转职：键盘玩家读 `game.skillBar / game.skillLv / game.job`；其他格斗者读自己的 `p.kit = { bar, lv, job, wtype }`（`barOf / lvOf / jobOf`）。
- 指令：`CLASSES[cls].cmds = [[方向序列, 技能 id, 按键], ...]`。方向：`f` 前、`b` 后、`u` 上、`d` 下，`'hold'` = 按住→，`''` = 只按键；按键省略 = Z（攻击类指令），`'buff'` = Space（BUFF 类，`cmdB`），`'attack'` = X，`'jump'` = C。长指令优先。用指令释放 MP −2%、冷却 −1%。技能窗口锁定指令后（`save.data.opts.cmdLock[id]`）只能用快捷栏。
- 指令文字：`cmdTextOf(id)`；某转职能学的技能：`classSkills(cls, job)`。

## 7. 决斗场

- 进入：`?duel=<sword|gun|mage|me>&vs=<职业>&job=<转职>&vsjob=<转职>&ai=1..3&lv=30&theme=<场景>`；`?auto` 让自己也交给 AI（测试用）。城镇里 NPC 的 `arena` 服务、界面组的 P 键都打开 `menus.open('duel')` 选择窗口。
- 三局两胜，每局 60 秒，时间到按剩余 HP 比例判定。双方按 `DUEL_BASE` 写入固定属性（天平系统），不看装备；决斗不写正式存档（存档键切到 `dawnbreak_duel`）。
- 画面：顶部双方血条（受伤后黄色残血）、MP、保护条（蓝 = 浮空、黄 = 倒地）、回合点、计时；中央 ROUND / FIGHT / K.O. / YOU WIN。
- AI（`FighterBrain`）：反应延迟后防守（后跳、翻滚、纵深躲投射物、格挡、抢招破招）、倒地受身、长连段时紧急闪避；进攻时对齐纵深、近身或保持射程、普攻起手接技能取消、浮空追击（跳攻 / 射击托空 / 再挑空）、倒地时枪手低射追击；BUFF 与觉醒找时机。难度 1..3 调整反应、欲望、防守与连招完整度。

## 8. 职业、转职与技能

转职等级 15。本作等级上限 30，原作转职技能的学习等级（15–45）按比例压缩到 15–27（原作 15→15、20→17、25→19、30→21、35→23、40→25、45→27），觉醒技能 18 级。技能名以国服资料为准（dnfziliao 国服技能库、官方资料站）；女枪的基础技能名与男枪不同（后撩踢 / 上旋踢 / 刺踢 / 钉刺射），女漫游觉醒为“血腥狂欢（沾血蔷薇）”，女枪炮师觉醒为“远古粒子炮（重炮掌控者）”，战斗法师觉醒为“变身贝亚娜（贝亚娜斗神）”。

`CLASSES[cls].jobs[jobId] = { name, role, armor, art, desc, skills, awaken, awakenName }`；转职完成后调用 `onJobChange(p, jobId)`。

#### 鬼剑士 · 基础技能
| 技能 | id | 指令 | 学习等级 | 类型 | 特性 |
|---|---|---|---|---|---|
| 上挑 | upslash | Z | 1 | 物理 | 起手霸体 |
| 鬼斩 | ghost | ↑+Z | 1 | 魔法·暗 |  |
| 格挡 | guard | ↓↓+X | 5 | 物理 | 按住持续 |
| 银光落刃 | silver | 跳跃中 Z | 5 | 物理 | 霸体、空中 |
| 空中连斩 | aircut | 跳跃中快捷栏 | 5 | 物理 | 空中 |
| 连突刺 | dashthrust | — | 5 | 物理 | 被动（跑攻中 X） |
| 崩山击 | slam | →↓+Z | 10 | 物理 | 蓄力（跳得更远）、空中 |
| 裂波斩 | rip | →↑+Z | 10 | 魔法 | 抓取 |
| 三段斩 | triple | 按住→+Z | 15 | 物理 | 追加 |
| 地裂·波动剑 | wave | ↓→+Z | 15 | 魔法 | 倒地 |
| 十字斩 | cross | ←→+Z | 15 | 物理 | 出血 |

#### 鬼剑士 · 剑魂（blade）
| 技能 | id | 指令 | 学习等级 | 类型 | 特性 |
|---|---|---|---|---|---|
| 后跳斩 | backslash | 后跳中 X | 15 | 物理 | 空中 |
| 里·鬼剑术 | rikiken | — | 15 | 物理 | 被动（普攻追加第 4、5 段） |
| 流心 | flow | 快捷栏 | 17 | 物理 | 流心状态：X 刺 / C 跃 / Z 升 |
| 流心·刺 | flow_stab | 流心中 X | 17 | 物理 |  |
| 流心·跃 | flow_leap | 流心中 C（空中再按 X 下斩） | 19 | 物理 | 霸体 |
| 流心·升 | flow_rise | 流心中 Z | 21 | 物理 |  |
| 流心·狂 | flow_frenzy | 快捷栏 | 21 | 物理 | BUFF |
| 破军升龙击 | rise | ←→→+Z | 21 | 物理 | 霸体 |
| 拔刀斩 | iai | ←↓→+Z | 23 | 物理 | 蓄力、霸体 |
| 猛龙断空斩 | dragon | ↑→→+Z | 25 | 物理 | 霸体、方向键改突进方向 |
| 幻影剑舞 | phantom | →↓→+Z | 27 | 物理 | 霸体、连按 X 加段 |
| 极·鬼剑术（暴风式） | awaken | ↑↑↓↓+Z | 18 | 物理 | 觉醒 |

#### 鬼剑士 · 狂战士（berserker）
| 技能 | id | 指令 | 学习等级 | 类型 | 特性 |
|---|---|---|---|---|---|
| 血之狂暴 | frenzy | ↓↑+Space | 15 | 物理 | BUFF 开关（耗血） |
| 血气唤醒 | bloodwake | — | 15 | 物理 | 被动（低血增伤） |
| 嗜魂之手 | soulhand | →→+Z | 17 | 物理 | 抓取吸血 |
| 暴走 | rampage | →→+Space | 17 | 物理 | BUFF |
| 怒气爆发 | outrage | ↓↑+Z | 21 | 物理 | 霸体 |
| 血气之刃 | bloodblade | ←←→+Z | 25 | 物理 | 霸体、耗血 |
| 崩山裂地斩 | quake | ↑→→+Z | 27 | 物理 | 霸体 |
| 魔狱血刹 | bz_awaken | ↑↑↓↓+Z | 18 | 物理 | 觉醒 |

#### 神枪手（女）· 基础技能
| 技能 | id | 指令 | 学习等级 | 类型 | 特性 |
|---|---|---|---|---|---|
| 后撩踢 | g_knee | Z | 1 | 物理 | 起手霸体 |
| 浮空弹 | g_launch | 按住→+Z | 1 | 物理 |  |
| M-137 格林机枪 | g_gatling | ↓→+X | 5 | 物理 | 连按 X 延长、↑ 斜上 |
| 银弹 | g_silver | →+Space | 5 | 物理·光 | BUFF |
| 上旋踢 | g_spin | ↓↓+X | 10 | 物理 |  |
| 钉刺射 | g_stomp | →↓+X | 10 | 物理 | 抓取 |
| 浮空铲 | g_slide | — | 10 | 物理 | 被动（滑铲浮空） |
| M-3 喷火器 | g_m3 | ←↓→+X | 10 | 物理·火 | 按住持续、可打倒地 |
| 刺踢 | g_flash | ↓→+Z | 15 | 物理 | 几率眩晕 |
| BBQ | g_bbq | ↓↑+Z | 15 | 物理 | 抓取 |
| G-14 手雷 | g_grenade | →↑+Z | 15 | 魔法 |  |

#### 神枪手 · 漫游枪手（ranger）
| 技能 | id | 指令 | 学习等级 | 类型 | 特性 |
|---|---|---|---|---|---|
| 左轮精通 | g_revmaster | — | 15 | 物理 | 被动 |
| 致命射击 | g_head | →→+Z | 15 | 物理 |  |
| 死亡左轮 | g_buff | →→+Space | 21 | 物理 | BUFF |
| 枪舞 | g_rapid | →←→+X | 23 | 物理 |  |
| 移动射击 | g_moving | ↓→+C | 23 | 物理 | 模式 |
| 多重爆头 | g_multi | ←↑→+Z | 25 | 物理 | 霸体 |
| 双鹰回旋 | g_hawk | ←↓→+Z | 27 | 物理 | 追加 |
| 血腥狂欢 | g_awaken | ↑↑↓↓+Z | 18 | 物理 | 觉醒 |

#### 神枪手 · 枪炮师（launcher）
| 技能 | id | 指令 | 学习等级 | 类型 | 特性 |
|---|---|---|---|---|---|
| 加农炮 | gl_cannon | ↑→+Z | 17 | 独立 | 蓄力、霸体 |
| 反坦克炮 | gl_antitank | ←→+Z | 17 | 独立·火 |  |
| 激光炮 | gl_laser | →→+Z | 19 | 独立·光 | 霸体 |
| 聚焦喷火器 | gl_flame | ←↑→+Z | 21 | 独立·火 | 霸体、可移动 |
| FM-31 榴弹发射器 | gl_fm31 | ↑→→+Z | 23 | 独立 |  |
| 量子爆弹 | gl_quantum | ↑↓+Z | 25 | 独立·光 | 可移动落点 |
| X-2 太阳神光炮 | gl_x1 | ←←→+Z | 20 | 独立·火 | 瞬发（不蓄气）、霸体、卷敌 + 灼烧后爆炸（官方 2022 年 X-2 取代 X-1，id 沿用） |
| 远古粒子炮 | gl_awaken | ↑↑↓↓+Z | 18 | 独立 | 觉醒 |

#### 魔法师（女）· 基础技能
| 技能 | id | 指令 | 学习等级 | 类型 | 特性 |
|---|---|---|---|---|---|
| 魔法星弹 | mg_orb | 快捷栏 | 1 | 魔法 | 蓄力、↑↓ 调整轨迹 |
| 天击 | mg_sky | Z | 1 | 物理 | 起手霸体、↑↓ 先侧滑 |
| 杰克爆弹 | mg_jack | ↓→+Z | 5 | 魔法·火 | 蓄力 |
| 光电鳗 | mg_eel | ↓↑+Z | 5 | 魔法·光 |  |
| 龙牙 | mg_fang | →+Z | 5 | 物理 | 长硬直 |
| 魔法护盾 | mg_shield | ↓↑+Space | 5 | 魔法 | BUFF |
| 暗影夜猫 | mg_cat | ←→+Z | 10 | 魔法·暗 |  |
| 冰霜雪人 | mg_snowman | ↓+Z | 10 | 魔法·冰 | 蓄力（蓄满冰冻） |
| 落花掌 | mg_palm | →→+Z | 15 | 物理 | 被击飞者撞人 |

#### 魔法师 · 元素师（elemental）
| 技能 | id | 指令 | 学习等级 | 类型 | 特性 |
|---|---|---|---|---|---|
| 烈焰冲击 | mg_flame | ↑↑+Z | 15 | 魔法·火 |  |
| 虚无之球 | mg_void | →↓→+Z | 17 | 魔法·暗 |  |
| 冰墙 | mg_icewall | ↓↓+Z | 19 | 魔法·冰 | 霸体、挡投射物 |
| 雷旋 | mg_vortex | ←↓→+Z | 19 | 魔法·光 | 蓄力 |
| 杰克降临 | mg_jackfall | ↑→→+Z | 23 | 魔法·火 | 霸体 |
| 天雷 | mg_thunder | ↑↓↑+Z | 23 | 魔法·光 | 光标定点 |
| 极冰盛宴 | mg_icefeast | ↑↓↓+Z | 25 | 魔法·冰 | 霸体 |
| 湮灭黑洞 | mg_hole | ←→→+Z | 25 | 魔法·暗 | 霸体、吸附 |
| 陨星幻灭 | mg_awaken | ↑↑↓↓+Z | 18 | 魔法 | 觉醒（只有霸体） |

#### 魔法师 · 战斗法师（battlemage）
| 技能 | id | 指令 | 学习等级 | 类型 | 特性 |
|---|---|---|---|---|---|
| 炫纹发射 | bm_chaser | 快捷栏（开关） | 15 | 魔法 | 炫纹系统 |
| 圆舞棍 | bm_round | →↓+Z | 17 | 物理 | 抓取 |
| 炫纹融合 | bm_fusion | ↓→+Space | 21 | 魔法 | BUFF |
| 碎霸 | bm_smash | ←↓→+Z | 21 | 物理 |  |
| 流星闪影击 | bm_flash | →↓→+Z | 23 | 物理 | 霸体 |
| 炫纹强压 | bm_press | ↑↓+Z | 23 | 魔法 | 霸体 |
| 强袭流星打 | bm_raid | ←→→+Z | 25 | 物理 | 蓄力、霸体 |
| 煌龙偃月 | bm_dragon | ↑→→+Z | 27 | 物理 | 霸体 |
| 变身贝亚娜 | bm_awaken | ↑↑↓↓+Z | 18 | 魔法 | 觉醒 |

## 9. 怎样新增一个技能

1. 在对应的职业文件里调用 `defSkill`：

```js
defSkill('my_skill', { name: '示例斩', cls: 'sword', job: 'blade',   // 基础技能不写 job
  lvReq: 21, maxLv: 10, mp: 30, cd: 6, type: 'phys', elem: 'light',
  desc: '技能说明（技能窗口显示）。', pow: lv => skillDmg(3.0, 0.3, lv),   // pow：提示用的总倍率
  ai: { kind: 'poke', r: [0, 90], dy: 22 },                                  // AI 用：种类、有效距离、纵深
  act: (lv, p) => ({ name: 'my_skill', clip: 'ghost', dur: 0.55, cancelFrom: 0.35, superArmor: [0, 0.1],
    hits: [HB(0.12, 0.2, [0, 90, 30, 0, 120], skillDmg(3.0, 0.3, lv), { launch: 420, knock: 80, hs: 0.08 })],
    events: [slashAt(0.11, { a0: -2.4, a1: 1.0, r: 60, w: 18, off: [10, 55] })] }) });
```

2. 把 id 加进 `CLASSES[cls].skills`（基础）或 `CLASSES[cls].jobs[job].skills`（转职）。
3. 需要指令就往 `CLASSES[cls].cmds` 里 push `['df', 'my_skill']`（按键第三项见第 6 节）。
4. 图标：把描述加进 `art/tools/combatgen.py` 的 `ICON_LIST`（16 个一张表），`python3 art/tools/combatgen.py icons`，再 `python3 art/tools/icons.py --combat`，得到 `art/final/icon/<id>.webp`。
5. 测试：`node test/skillshots.mjs sword:blade` 看连拍，`node test/combat.mjs`、`node test/duel.mjs` 回归。

常用构件（`common.js`）：`HB` 攻击判定、`blast` 地面范围攻击、`shootProj` 直线投射物、`lobProj` 抛物线投掷、`groundPillar` 地面柱、`aimAhead / nearestFoe` 找目标、`throwGrab` 抓取投掷、`toggleBuff / setPassive` BUFF 与被动、`fxSpr / fxBeam / fxCharge` 特效。

## 10. 怎样新增一个转职

1. 新建 `src/content/classes/<职业>_<转职>.js`，加到 `src/ORDER` 里对应职业文件之后。
2. 用 `defSkill` 定义技能（都写 `job: '<转职 id>'`），觉醒技能写 `awaken: true, lvReq: 18, maxLv: 3, pvp: 0.45`。
3. 登记转职：

```js
CLASSES.sword.jobs.newjob = { art: 'job/newjob', name: '新转职', role: '近战 · 连击', armor: 'light',
  awaken: 'nj_awaken', awakenName: '觉醒称号', desc: '转职说明',
  skills: ['nj_a', 'nj_b', 'nj_awaken'] };
CLASSES.sword.cmds.push(['bff', 'nj_a'], ['uudd', 'nj_awaken']);
```

4. 被动：往 `CLASSES[cls].passives` 里 push `p => setPassive(p, 'id', 条件, { dmg: 0.1, aspd: 0.05 })`；命中钩子写在 `CLASSES[cls].onHit = (p, t, h, dmg, act) => {...}`（例：狂暴出血、炫纹）。
5. 动作帧：按第 11 节出一张转职动作表。

## 11. 怎样新增一套动作帧

1. 在 `art/tools/combatgen.py` 的 `SHEETS` 里加一张表：键名 `<角色>_<表名>`，8 帧 `(帧名, 英文动作描述)`，人物一律面朝右。涉及手脚方向的动作要写清楚“近侧 / 远侧”，必要时用 `poseguide.py` 画姿势参考图。
2. `python3 art/tools/combatgen.py sheets --only <角色>_<表名>` 生成（参考图 `art/src/<角色>_ref.png`，原图写到主仓库 `art/src/combat/sheets/`）。
3. **逐帧看图检查**：有没有顺拐、丢武器、两个动作粘连、多画了别人的手。小问题可以直接改原图（先存 `_raw.png` 备份）。
4. `python3 art/tools/frames2.py --src /Users/luzhipeng/projects/dawnbreak/art/src/combat/sheets --keep <角色>_<表名>` 切帧并追加到 `art/final/spr/<角色>/`（沿用现有比例，不删其他帧）。看 `art/cut/sheets2/<表>.png` 预览，每格一个黄框、没有粘连。
5. 在 `src/content/sprites.js` 的 `SPR_ANIMS[<角色>]` 里加片段：`myClip: [['帧1', 0], ['帧2', 0.12]]`（一次性，按动作内时间切换）或 `{ fps, frames: [...] }`（循环）。动作里写 `clip: 'myClip'` 即可（骨骼兜底片段会自动补）。
6. `node build.mjs`，`node test/motion.mjs <职业>`、`node test/skillshots.mjs <职业>:<转职>` 看连拍。

觉醒插图：`combatgen.py` 的 `CUTIN` 里每个转职一张（`python3 art/tools/combatgen.py cutin`，`python3 art/tools/combatgen.py cutinprep` 输出 `art/final/cutin/<转职>.webp`）；觉醒技能里写 `game.cutin = { t: 0, dur: 1.0, name, who: cutinWho(e) }`，有转职插图时用转职的，否则用职业插图。

外观层（外观与换装组）：`SpriteModel.draw` 里有钩子 `model.av = { frame(m, f), under(c, m, f, F), over(c, m, f, F) }`，用来换帧来源（时装）和叠加武器 / 配件；没有 `av` 时行为不变。

特效：在 `combatgen.py` 的 `FX` 里加一项（发光类用黑底），`python3 art/tools/combatgen.py fx --only <名字>`，`python3 art/tools/fxprep.py --combat`；代码里 `fxSpr('<名字>', x, y, z, { w, dur, grow, col })`，需要换色时把原图色相写进 `fx.js` 的 `FX_BASE_HUE`。

## 12. 测试

| 命令 | 内容 |
|---|---|
| `node test/combat.mjs` | 机制：伤害类型 / 属性 / 破招 / Miss / 暴击 / 背击 / 浮空衰减与重力 / 倒地追击与强制起身 / 霸体与抓取 / 僵直度 / 取消规则 / 蓄力 / 攻速 / 格挡 / 抓取技 / 指令输入 / 连招 / 受身 / 后跳 / 决斗场保护 |
| `node test/skillshots.mjs sword,sword:blade,...` | 每个技能对木桩施放、连拍，检查能放出来、能回到可行动状态、无报错 |
| `node test/duel.mjs sword:gun,gun:mage,mage:sword` | AI 对 AI 打完三局两胜，统计双方技能、伤害、受身、后跳、闪避、抓取、保护触发 |
| `node test/perf.mjs sword,gun,mage` | 持续战斗与决斗场的帧率、逻辑 / 渲染耗时 |
| `node test/motion.mjs <职业> [转职]` | 走跑、连段、浮空追击、受击（轻 / 重 / 浮空 / 倒地）、受身、被抓的连拍 |
| `node test/classes.mjs sword,gun,mage,sword:blade,...` | 在一群哥布林里依次施放技能栏上的全部技能（基础 / 转职），检查每个技能都放得出来、无报错 |
| `SPEED=3 node test/botrun.mjs lorien:5:0:sword` | 机器人通关（PvE 回归） |
