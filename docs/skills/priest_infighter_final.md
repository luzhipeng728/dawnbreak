# 蓝拳圣使（priest:monk，文件名 infighter）逐技能对齐官方

出处：namu `인파이터(던전앤파이터)/남자/스킬`（2026 修订，现版数值 / 冷却 / 意念驱动规则，下称 N）+ wiki.dfo.world 各技能页（Will_Driver、Ducking_Dash、Sway、Ducking_Straight_Punch、Ducking_Uppercut、Ducking_Body_Blow、Divine_Crush、Sidewind、Exquisite_Combo、Sacred_Counter、Chopping_Hammer、Shadow_Clone、Machine_Gun_Jab、Corkscrew_Blow、Heavenly_Combo、Hurricane_'n'_Roll、Big_Bang_Punch、Gattling_Punch、Demolition_Punch、Nuclear_Punch、Atomic_Chopper、Wrath_of_God、Furious_Judgment、Justice_Execution，下称 D）+ 国服官方中文名（dnf.qq.com 2020 男圣职者改版专题、dnfziliao，下称 CN）。
视频：D 页演示视频 DBscnDhwon8（俯冲）、swqfE7zJQrw（摆动）、BBiDosjz6-U（俯冲直拳）、W-jv-OXjSFg（俯冲翔拳）、i06JiibDX_I（俯冲腹拳）、TBAe-BWpwb4（神圣反击）、kEIITibH_HA（破碎之锤）、S3XQgmKluPU（极速飓风拳）、9ohdkD-19zc（泯灭神击）、vu7yTRObV2E（破碎之拳）、iKNJLYZgRmY（破坏之拳）、GNGgFQgCJrQ（仲裁怒击）、6G1OE0mTlgQ（超重拳）、Nj7ksNskP8w（制裁：怒火疾风）。
docs/SKILLS_OFFICIAL_priest.md 的蓝拳一节是旧版技能表，这次以 N / D 现版为准逐条核过。国服名：데스 블로우 = 正义惩戒、핵 펀치 = 仲裁怒击、아토믹 쵸퍼 = 超重拳（CN）。
代码：`src/content/classes/priest_infighter.js`（意念驱动 + Lv15~20 转职技能）、`priest_infighter_p1.js`（干涸之泉 + 觉醒段 + 登记）；转职 id 仍是 P-core 骨架里的 `monk`（原 `priest_monk.js` 改名为 `priest_infighter.js`，`test/affected.mjs` 的 JOB_OF 加了 infighter → monk）；规格：`docs/skills/priest.json`（skillaudit `--compare` 24 个主动技能不一致 0）；测试：`test/priest_infighter.mjs`（登记 + 逐技能 放出 / 命中 / 冷却 / MP）、`test/infighter.mjs`（机制）；连拍：`test/shots/skills/priest-monk.jpg`。
等级压缩、伤害尺度、状态含义同 `priest_crusader_final.md`。

## 系统
| 项 | 官方 | 本作 | 状态 |
|---|---|---|---|
| 意念驱动 | 巨兵插在地上时才能用转职技能（神圣反击除外），光环里暴伤 / 暴击 / 命中 + 冷却 −10%；进图 / 换房间自动插；按住技能键收回（N 2.1） | `p.piWill = { room, x, y }`；`piEnsureWill` 在地下城 / 测试房自动插（决斗场不插，手动收回后本房间不再自动插）；`piNeedWill` 作为 req；普攻换成拳击 `piFistActs`；插着时空斩打 / 落凤锤被 `PRIEST_HOOKS.req` 挡住；手上的十字巨兵在插下后隐藏（`piHideHandCross`） | 一致 |
| 干涸之泉（取消） | 神击系技能之间强制中断，3.5 s 一次（决斗场 10.5 s）；俯冲系 / 破碎之锤不能被取消进去；仲裁怒击和觉醒放出后不能再取消（N） | `PRIEST_HOOKS.cancelHook / softCommit`：`PI_DRY_NOIN / PI_DRY_NOOUT` 名单，3.5 s 冷却，HUD 标签显示可用 | 一致 |
| 俯冲 / 摆动派生 | 俯冲中 X / ↑X / ↓X = 直拳 / 翔拳 / 腹拳；摆动中 X = 破碎之锤；技巧精通后交叉可用；俯冲和摆动互相取消（N / D） | `links` + `onInput`；直接从技能栏放派生技能时先自动小冲 / 小撤一步（本作方便，写在规格 why 里） | 一致 |
| 觉醒自动学会 | 一 / 二 / 三觉完成任务时自动获得、0 SP、等级随角色等级；干涸之泉一觉时给 Lv1（D） | `PI_AUTO`：泯灭神击、干涸之泉 Lv1、制裁：怒火疾风、正义执行 0 SP 自动学会并进技能栏（测试覆盖） | 一致 |
| 觉醒取消 | 觉醒技可以从任何技能切入 | `awkcancel` 30 个技能全部切入，挡住 0 | 一致 |
| 动作帧 | — | `PI_ANIMS` 直接用 P-art 的真帧（docs/PRIEST_ART.md §7.4 的 pm_ 前缀：pm_duck / pm_sway / pm_jab / pm_straight / pm_upper / pm_rush1~2 / pm_counter + 基础帧 p_hookDash / p_slamUp / p_slamDown / p_pray1~2；技能 id 用 pi_、帧名用 pm_ 不冲突）；插着巨兵时手里的十字架不画（矢量模型藏部件，精灵模型包外观层的 weapon） | — |
| 插图 | 三个觉醒技都有插图 | `art/final/cutin/monk{,2,3}.webp`（轻装 + 拳带 / 拳头十字，金发圣职者脸）；转职立绘 `art/final/job/monk.webp` | 一致 |

## 技能
| 技能 | 官方要点（来源） | 本作 | 状态 |
|---|---|---|---|
| 百炼成钢 pi_body | 被动，转职自带：移速 / 攻速 / 跳跃提高，拳气让普攻打得到低处（N） | 同；移速 +15%、攻速 +10%，上勾拳 / 跑攻能打倒地 | 一致 |
| 意念驱动 pi_will | ↑↓+Space；瞬间；插巨兵：150 px 硬直、750 px 光环；按住收回；CD 5 s（N） | 同；点一下 = 重新插在脚下，按住 ≥0.3 s = 收回（幻影化身一起解除） | 一致 |
| 技巧精通 pi_tech | 被动：攻击 / 移速提高、距离变长；俯冲 / 摆动派生交叉、吸怪、反击主动冲出、部分霸体、俯冲系 / 圣拳连击追加打击（N） | 同；追加打击 `PI_TECH_EXTRA`（保留目标原有硬直） | 一致 |
| 俯冲 pi_duck | 意念驱动中 Z；前冲 150 px（0.5 s，↑↓ 斜冲），0.25 s 无敌、最下段；跳跃键停下；和摆动互相取消；CD 0.7 s（N / 视频 DBscnDhwon8） | 同；体检位移 164 px、无敌 57% 动作 | 一致 |
| 摆动 pi_sway | ↓↓+C；后撤 150 px，0.25 s 无敌；和俯冲互相取消；CD 0.7 s（N / 视频 swqfE7zJQrw） | 同；体检 −160 px | 一致 |
| 俯冲直拳 pi_dstraight | 俯冲中 X；直拳打退；技巧精通追加 5%×2；CD 3.5 s（N / 视频 BBiDosjz6-U） | 同；1 + 2 段追加 | 一致 |
| 俯冲翔拳 pi_dupper | 俯冲中 ↑X；上勾拳挑空，最下段到最上段都能打；CD 3.5 s（N） | 同 | 一致 |
| 俯冲腹拳 pi_dbody | 俯冲中 ↓X；长硬直、几率眩晕、不倒地；技巧精通霸体 + 追加 10%；绝对正义：打中后俯冲 / 摆动取消后摇；CD 3.5 s（N / 视频 i06JiibDX_I） | 同；幻影 / 追加打击 / 光之复仇都不会把长硬直覆盖成短的 | 一致 |
| 急速闪避 pi_parry | 被动：神击系技能起手 0.6 s 回避 75%，躲开时 10 s 暴击 +10%（4 层）（N） | 同；在 `beforeHurt` 里判定 | 一致 |
| 圣拳锤击 pi_crush | →↑+Z；一拳砸地（397% + 冲击波 3575%），轻挑；可取消普攻；CD 5 s（N） | 同；2 段 | 一致 |
| 瞬拳 pi_side | ←→+Z；伸得很远的弹击拳（3073%），再按追加贴地一击把敌人拽过来（768%）；CD 4 s（N） | 同；伸出 300 px（+2.7 px/技巧精通级），再按 follow 拽回 | 一致 |
| 圣拳连击 pi_gorgeous | →→+Z；刺 / 直 / 摆 3 连（1556 : 1901 : 2304），霸体；摆拳后俯冲 / 摆动取消；CD 7 s（N） | 同；技巧精通追加打击后 6 段 | 一致 |
| 神圣反击 pi_counter | ↓↓+Z；祈祷架势，正面挨打受到伤害 −90% 并冲出腹拳反击；技巧精通再按主动冲出；不用插巨兵；CD 6 s（N / 视频 TBAe-BWpwb4） | 同；`beforeHurt` −90% + `piCounterStrike` | 一致 |
| 破碎之锤 pi_chop | 摆动中 X；冲出下劈钩拳，敌人撞地弹起时冲击波；下劈前霸体；绝对正义：落点插巨兵神圣爆炸；CD 6 s（N / 视频 kEIITibH_HA） | 同 | 一致 |
| 幻影化身 pi_shadow | ←→+Space；施放 0.5 s；影子分身追加打击（5+1.5n%），要插着巨兵，收回时解除；地下城无限（决斗场 10 s）；CD 5 s（N） | 同；`piShadowK` | 一致 |
| 双重幻影 pi_double | 被动：多一个分身，攻击力 50%（N） | 同 | 一致 |
| 刺拳猛击 pi_mgjab | ↑→→+Z；刺拳 15 下（连按更快）+ 下砸终结 + 攻击键追加上勾拳；霸体；技巧精通吸怪；CD 10 s（N） | 同；体检 16 段、挑空 | 一致 |
| 旋涡重拳 pi_cork | ↑→+Z；旋风吸到拳前控制（704%×10）+ 下砸（10577%）；俯冲 / 摆动中可用；霸体；CD 20 s（N） | 同；11 段；旋风改成 orb 染色 + 斩痕（vortex 素材不能染色） | 一致 |
| 神圣组合拳 pi_heavenly | ↓→→+Z；右勾 / 左勾 / 直拳（3860 : 5033 : 7886），纵深聚怪；直拳后俯冲 / 摆动取消；CD 16 s（N） | 同 | 一致 |
| 极速飓风拳 pi_hurricane | ←↓→+Z；吸 936 px 的敌人，左右勾拳 10 下 + 上勾拳；前后移动、连按加速、跳跃键直接上勾拳；前后都有判定；CD 45 s（N / 视频 S3XQgmKluPU） | 同；11 段、打到 450 px；龙卷风素材改成冲击波（tornado 不能染色） | 一致 |
| 干涸之泉 pi_dry | 一觉被动（Lv1 自动）：见“系统”；打击攻击力提高（N） | 同 | 一致 |
| 泯灭神击 pi_awaken（一觉） | ↑↑↓↓+Z；右勾（Side!）/ 左勾（Chest!）/ 下劈（Stun!）/ 冲刺直拳（Big! Bang!，可蓄）（9047 : 13983 : 18094 : 41125）；无敌；幻影中 ×1.1；CD 135 s（N；D 145）（视频 9ohdkD-19zc） | 同；下劈 Stun! 让敌人原地眩晕 1.8 s 等最后一拳（之前挑空后倒地会漏掉最后一拳，已改），最后一拳冲 420 px/s、判定 [−60, 230]、能打倒地；体检 4 段 | 一致 |
| 破碎之拳 pi_gatling | →←↓→+Z；双拳 10 下 + 下砸 + 爆炸；连按加速、跳跃键终结；技巧精通吸怪；CD 35 s（N / 视频 vu7yTRObV2E） | 同；12 段 | 一致 |
| 破坏之拳 pi_demo | Space；向上强力钩拳（抓取判定，连霸体拎起）+ 冲击波挑高；俯冲 / 摆动中可用；CD 40 s（D / 视频 iKNJLYZgRmY） | 同；`throwHit` 抓取，抓不住的只受伤害 | 一致 |
| 正义惩戒 pi_death | 二觉被动：普攻 / 技能攻击、命中提高（现版无条件增伤）（N / CN 名） | 同 | 一致 |
| 仲裁怒击 pi_nuke | →←→+Z；致命重拳（64869%），打中才出冲击波打后面（27801%）；干涸之泉能取消进来、放出后不能取消；CD 40 s（N / 视频 GNGgFQgCJrQ） | 同；冲击波打到 450 px | 一致 |
| 超重拳 pi_atomic | ←→→+Z；上勾挑起 + 几乎同时猛砸（21103 : 84415）；俯冲 / 摆动中施放更快；CD 50 s（N / 视频 6G1OE0mTlgQ） | 同；强制弹地 | 一致 |
| 制裁：怒火疾风 pi_awaken2（二觉） | ↓↑→→+Z；施放 0.5 s；跳起砸地后在 600 px 内敌人之间穿梭 19 下，聚怪，再现身 2 下 + 全画面大爆炸；无敌；CD 170 s（N；D 180）（视频 Nj7ksNskP8w / CN 名） | 同；穿梭时隐身、结束恢复；体检 23 段 | 一致 |
| 绝对正义 pi_one | 三觉被动：攻击提高；俯冲腹拳可取消后摇；破碎之锤改为落点插巨兵神圣爆炸（N） | 同 | 一致 |
| 正义铁拳 pi_furious | ↑↓→→+Z；下砸冲击波挑起 → 高速移动聚怪连打 15 下 → 钩拳终结；连按加速、跳跃键终结；CD 60 s（N / CN 名） | 同；17 段、打到 450 px | 一致 |
| 正义执行：雷米迪奥斯的圣座 pi_awaken3（三觉） | ←↑→↓+Z；巨兵化为圣座，圣域里的敌人被拉到面前跪地，神圣拳铠上勾拳（219090 : 328636）；无敌；和联动的觉醒共用冷却；CD 270 s（N；D 290 / CN 名） | 同；联动是 switchOpt（默认泯灭神击）；联动觉醒冷却中三觉放不出，反之亦然 | 一致 |

## 验证
- `node test/priest_infighter.mjs`、`node test/infighter.mjs` 全部通过。
- `node test/skillaudit.mjs priest:monk --compare`：24 个主动技能有规格，不一致 0。
- `node test/awkcancel.mjs priest:monk`：切入觉醒 30 / 挡住 0。
- `node test/skillshots.mjs priest:monk`：34 个技能问题 0（空斩打 / 落凤锤插着巨兵时按官方放不出，标“前置条件”）。
