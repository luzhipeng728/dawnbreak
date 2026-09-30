# 圣骑士（priest:crusader）逐技能对齐官方

出处：namu `크루세이더(던전앤파이터)/남자/스킬`（2026-08 修订，现版数值 / 冷却 / 路线规则，下称 N）+ wiki.dfo.world 各技能页（Revenge_of_Light、Holy_Ghost_Mace、Spear_of_Victory、Light_of_Divinity、Sign_of_Protection、Divine_Invocation、Fountain_of_Life、Healing_Wind、Crashing_Cross、Deflection_Wall、Flash_Sphere、Haptism、Hammer_of_Repentance、Righteous_Judgment、Apocalypse_(Male_Crusader)、Miracle_Splitter、Doom_Spear、Divine_Flash、Holy_Sanctuary、Thunder_Hammer:_Jupiter、Ascension、Punishment_(Male_Crusader)、Holy_Rage:_Astrape、Final_Judgment，下称 D）+ 国服官方中文名（dnf.qq.com 2020 男圣职者改版专题、dnfziliao，下称 CN）。
视频：D 页演示视频 PtEXzKqLlUk（光之复仇）、qg7YrSz_GzI（圣灵之槌）、vDqGAdlwroQ（胜利之矛）、qt2Xp2QDwME（圣光守护）、7VNo4J1CQis（生命源泉）、Etqo8GxVPEo（圣愈之风）、JWK1jK8nIdk（圣光沁盾）、4RkMnSzr8Ec（圣光球）、8-kXw6RRxCs（忏悔之锤）、cQi0NKnH6Kg（正义审判）、SNLC4nK3wZ8（神圣之光）、Q2AkEpzp4P0（圣佑结界）、fNS2onOaXUc（信仰之翼）；只拿来比形状、颜色和节奏。
docs/SKILLS_OFFICIAL_priest.md 的圣骑士一节是上一个代理的调研：技能表停在旧版（Lv115 前、还有已删除的技能），这次以 N / D 现版为准，逐条核过。
代码：`src/content/classes/priest_crusader.js`（核心 + Lv15~20 转职技能）、`priest_crusader_p1.js`（觉醒段 + 路线 / 自动学会 / 登记）；规格：`docs/skills/priest.json`（skillaudit `--compare` 24 个主动技能不一致 0）；测试：`test/priest_crusader.mjs`（登记 + 两条路线逐技能 放出 / 命中 / 冷却 / MP）、`test/crusader.mjs`（mech 机制、coop 2 人真联机辅助、shots 守护路线连拍）；连拍：`test/shots/skills/priest-crusader.jpg`（战斗路线）、`test/shots/crusader/support.jpg`（守护路线）。
等级按本作 Lv60 压缩：官方 ≤15 不变，其余 round(15 + (官方−15)×15/85)；一觉段 21~25、二觉段 26~27、三觉段 29~30。伤害倍率按本作同冷却技能的尺度，官方百分比只用来定分段比例。
状态：一致 = 机制 / 段数 / 指令 / 冷却都对得上；近似 = 机制对得上，数值或表现按本作尺度 / 素材做了调整（写明哪里不同）。

## 系统
| 项 | 官方 | 本作 | 状态 |
|---|---|---|---|
| 两条路线 | 转职后在「勇气恩赐（战斗）」和「守护恩赐（纯辅助）」之间二选一（技能窗口开关，互斥）；守护路线：辅助技能可用、单刷有专用增伤 + 冷却 −20%；勇气路线：天启之珠不给 BUFF、冷却变短，神圣之光只能对自己，信仰之翼不能用（N 1.2 / 2.1） | 默认战斗路线（首次转职时 `opts.pcRouteInit` 把 `swOff.pc_guard` 设为关）；守护恩赐是 `switchOpt` 被动（技能窗口「守护路线（纯辅助）」开关，和其他转职的 switchOpt 一样）；守护路线：辅助技能解锁、勇气恩赐 / 圣灵之槌不生效、单刷冷却 ×0.8；战斗路线：辅助技能 req 挡住并提示“需要开启守护恩赐” | 一致 |
| 队伍原语 | 荣誉祝福 / 守护徽章 / 天启之珠等 BUFF 给范围内队员；圣光守护 / 生命源泉 / 神圣之光选一名队员 | 全部走 P-core 的 `partyCast('buff'/'shield'/'heal'/'cleanse'/'revive')`：自己 `partyMyUid()`、队友 `ghost.uid`；自定义种类 `pc_extend`（神圣之光延长 BUFF）、`pc_cleanse`（圣佑结界解异常）用 `partyOn` 注册；2 人联机测试里 B 都拿到 | 一致 |
| 独立攻击 | 圣骑士的攻击技能算独立攻击（N） | `PRIEST_HOOKS.mod` 对圣骑士把 type 改成 `indep` | 一致 |
| 觉醒自动学会 | 一 / 二 / 三觉完成任务时自动获得觉醒技、0 SP、等级随角色等级（D） | `PC_AUTO`：完成觉醒 flag 后 0 SP 自动学会并放进技能栏；战斗路线下信仰之翼学会但不占栏（放不出），惩罚进栏；三觉技能等级随角色等级；一键加点也会学（测试 W） | 一致 |
| 觉醒取消 | 觉醒技可以从任何技能切入 | 引擎保证；`awkcancel` 23 个技能切入 22（天怒在空中不切），挡住 0 | 一致 |
| 插图 | 三个觉醒技都有插图 | `art/final/cutin/crusader{,2,3}.webp`（重甲 + 盾 / 十字，金发圣职者脸），`cutinWho(e, tier)` 取图；转职立绘 `art/final/job/crusader.webp` | 一致 |

## 技能
| 技能 | 官方要点（来源） | 本作 | 状态 |
|---|---|---|---|
| 神的恩赐 pc_god | 被动，转职自带；异常抗性提高（N） | 自动学会；本作没有异常抗性字段，改成“身上异常状态持续 −5%” | 近似 |
| 勇气恩赐 pc_courage | 战斗路线被动：普攻 / 技能攻击提高，路线规则见上（N 2.1） | 自动学会；守护路线开启时不生效 | 一致 |
| 守护恩赐 pc_guard | 纯辅助路线被动：体力 / 精神提高、辅助技能可用；组队时打到的敌人属性伤害提高；单刷专用增伤 + 冷却 −20%（N） | switchOpt 开关，默认关；最大 HP / 减伤；组队 vuln 减益（10 s，3 层）；单刷独立攻击 + 冷却 ×0.8 | 近似（体精 → HP / 减伤） |
| 坚定意志 pc_firm | 被动：普攻 / 转职技能攻击、魔法暴击提高（N；国服名未查到，按意思译） | 同；两条路线都生效 | 近似（名称为译名） |
| 光之复仇 pc_revenge | →↓+Space；施放 0.5 s；永久 BUFF：攻击时 100%（0.2 s 间隔）、被魔 / 物攻击 80% / 42% 落雷，被打时 10% 感电 5 s；学神罚之锤后不能手动放、放神罚之锤时自动施放；CD 10 s（D / N / 视频 PtEXzKqLlUk） | 同；落雷保留目标原有硬直（`max(t.stun, 0.12)`，不打断腹拳等长硬直）；神罚之锤学会后 req 挡住并提示 | 一致 |
| 圣灵之槌 pc_mace | ↑→→+Space；瞬间；勇气路线 BUFF：普攻变战槌 3 连（第 3 下 / 空斩打冲击波）、技能攻击 +2n%、速度 / 命中提高；CD 7 s（N；D 旧值 5 s） | 同；`PRIEST_ACT_PICK` 换普攻（距离更长，第 3 下圣光冲击打到 170 px） | 一致 |
| 胜利之矛 pc_spear | →↑+Z；瞬间、可按住蓄 0.3 s；投矛贯穿（10 / 满蓄 16 个），贯穿的敌人拖到落点，落地爆炸；神之代行者：直接满蓄、矛更大、再按引爆；CD 6.6 s（N / 视频 vDqGAdlwroQ） | 同；矛是 field 召唤 `pc_spear_f`：贯穿钉住 → 落点爆炸；代行者再按技能键立即引爆；体检射程 450 px | 一致 |
| 圣光守护 pc_light | →↑+Space；施放 0.7 s；守护路线；1200 px 内一名队员 8 s 护盾 = 圣骑士 HP×(7+0.5n)%；CD 15 s（D / 视频 qt2Xp2QDwME） | 同；`partyCast('shield')`，优先 HP 比例最低的队员；联机 B 拿到护盾 | 一致 |
| 守护徽章 pc_sign | ↓→+Space；施放 0.5 s；900 px 内队员 300 s 防御 / 体精 / HP·MP 上限（D） | 同；BUFF 字段 hpPct / mpPct / taken（本作没有防御字段） | 近似（防御 → 减伤） |
| 荣誉祝福 pc_honor | ←→→+Space；施放 0.5 s；900 px 内队员（不含自己）攻击 / 力智 / 命中提高，自己技能攻击提高；300 s；CD 10 s（D） | 同；队友 `pc_honor_p {atk}`、自己 `pc_honor {dmg}`；信仰之翼圣力层数加成 | 一致 |
| 快速愈合 pc_fastheal | 被动：缓慢愈合回复时间缩短、回复量提高、施放更快（D） | 放缓慢愈合时改写事件：1 s 回满（hot BUFF t 1.2，避开 1 s 整点不结算）、135%、施放 0.5 s | 一致 |
| 生命源泉 pc_fountain | ↑↑→+Space；施放 0.8 s；1200 px 内一名队友（不含自己）200 s HP 回复 + 死亡时复活（24.5+0.5n%）；组队才能用、决斗场不能用、12 次；CD 60 s（D / 视频 7VNo4J1CQis） | 同；BUFF `{hot, life}` 走引擎 lifeSave 复活；单刷 req 挡住（体检写了 why）；联机：B 受致命伤害后不死、回 25% | 一致 |
| 圣愈之风 pc_wind | →←→+Space；施放 0.5 s；900 px 内队员 1 s 内回复 HP / MP (24+n)%，护盾 = 圣骑士 HP 23%；跳跃键取消（D / 视频 Etqo8GxVPEo） | 同；联机 B 0.30 → 0.55 + 护盾 | 一致 |
| 灵魂牺牲 pc_sacrifice | 被动：速度 / 攻击提高；圣骑士死亡时周围队员回复 HP / MP（D） | 同；`pcOnDeath` 给 1600 px 内队员 heal | 一致 |
| 圣光十字 pc_cross | ↓↓→+Z；瞬间；投十字架，打中爆炸并在脚下生成五芒星阵（15 s 全速度 +5%，守护路线阵里的队友也加）；代行者变大、命中处也有阵（D） | 同；`pcCrossField` 召唤阵；体检 2 段、挑空、打到 170 px | 一致 |
| 圣光沁盾 pc_wall | ←→+Z；施放 0.5 s；前方缓慢前进的圣力墙（生成 / 接触各一次伤害），敌人和子弹过不去、队友能过；5 s；CD 8 s（D / 视频 JWK1jK8nIdk） | 同；field `pc_wall_f` 推人 + `eraseProjs` 挡子弹；体检打到 300 px | 一致 |
| 双子沁盾 pc_pwall | 被动开关：两面墙相向移动、相撞爆炸夹住中间的敌人（N） | switchOpt；两面墙 HP 120%，相撞 / 爆炸各 50%（`pcWallClash`） | 一致 |
| 圣光球 pc_sphere | →→+Z；施放 0.5 s；缓慢前进 3 s、0.2 s 一段共 15 段，消失时 300 px 眩晕 6 s；按→ 更远；CD 14.4 s（D / 视频 4RkMnSzr8Ec） | 同；速度 35、半径 88，体检 14 段 | 一致 |
| 神圣琉璃球 pc_shrapnel | 被动开关：圣光球碰到就爆（一次大伤害 + 眩晕）（N） | switchOpt；14 倍单段 + 300 px 眩晕 | 一致 |
| 圣光聚合 pc_haptism | →↓+Z（和虎袭同指令，冷却长的优先）；瞬间、没有霸体；光柱 → 砸地 → 爆炸（14 : 28 : 107），爆炸吸怪；可取消普攻；CD 10 s（D / N） | 同；3 段、前后都打、把周围敌人拉过来（体检 pull） | 一致 |
| 忏悔之锤 pc_hammer | →↓→+Z；瞬间（挥锤速度吃施放速度）、挥锤霸体；前方很宽、身后也有判定；锤子打中几率忏悔（敌人互相攻击，领主减半、决斗场无效），冲击波不忏悔；CD 14.4 s（D / 视频 8-kXw6RRxCs） | 同；金色巨锤从 −2.1 挥到 1.15 rad（之前是绿色方块，已重画）；判定 [−90, 250]；忏悔 = `confuse` 状态 | 一致 |
| 正义审判 pc_judge | ←↓→+Z；施放 0.6 s；法阵落 16 把光之刃，然后正义天使投长矛；落刃中跳跃键立即召唤天使；全程霸体；CD 45 s（D / 视频 cQi0NKnH6Kg） | 同；17 段（16 刃 + 矛）、300 px | 一致 |
| 天启之珠 pc_awaken（一觉） | ↑↑↓↓+Z；施放 1 s 无敌；天空打开，落雷和光之矛；守护路线 33 s 队员力智（不含自己）/ 速度 BUFF；勇气路线不给 BUFF、冷却 135 s、全画面；CD 160 s（N / D / CN 名） | 同；守护 12 击 / 战斗 16 击，75% 对准敌人；BUFF `pc_apoc`；战斗路线 onCast 改冷却 135；联机 B 拿到祝福 | 一致 |
| 信念光环 pc_aura | 一觉被动：攻击提高；守护路线 900 px 光环给队员属性 / 速度，队友攻击力（N） | 同；光环每 2 s 广播一次 BUFF | 一致 |
| 冥想 pc_medit | 一觉被动（守护）：体精 / 物魔暴击按较高的一方对齐（N） | 本作物理暴击率提高到和魔法暴击一样（独立攻击吃物理暴击） | 近似 |
| 圣光突袭 pc_splitter | →←↓→+Z；瞬间；冲刺 240 px（3 段）后巨兵上挑（46×3 : 309）；CD 30 s（D） | 同；移动 [[0.03, 0.27, 720]]，体检位移 255 px、4 段、挑空 | 一致 |
| 神圣之矛 pc_doom | ↓↓↓+Z；瞬间；投远古神圣之矛，推着贴身敌人到落点，落地 / 砸地 / 爆炸 3 段（17 : 73 : 205×3）；CD 40 s（D） | 同；5 段、打到 300 px | 一致 |
| 神圣之光 pc_flash | →←→+Z；施放 0.5 s；（被动体精）选 1800 px 内一名队员：他身上爆炸（对队友 +150%）、受到伤害 −20%（0.8 s）、徽章 / 荣誉祝福 +70 s；勇气路线只能对自己；CD 20 s（D / 视频 SNLC4nK3wZ8） | 同；`pc_extend` 延长队友 BUFF；战斗路线只对自己 | 一致 |
| 圣佑结界 pc_sanct | ↓↑→+Z；瞬间，约 1 s 内方向键挪法阵、再按提前放下；闪 5 次：推出并伤害敌人、回复阵里队员并解异常，最后一次最强、纵向大；在场时再按立即引爆；CD 40 s（D / 视频 Q2AkEpzp4P0） | 同；field `pc_sanct_f`，最后一闪半径 250；`pc_cleanse` 解异常 | 一致 |
| 神罚之锤 pc_jupiter | ↓→→+Z；瞬间（前半段无敌）；永久装备：技能攻击 +(32+2n)%、普攻改写（光属性独立攻击，第 3 下 / 空斩打圣光冲击、跑攻 3 段雷枪）、落凤锤变雷霆重击、光之复仇自动施放；CD 45 s（D / N） | 同；`pcActsFor(w, jup)` 换普攻；落凤锤 onCast 追加 `pcThunderCrush` 3 道雷 | 一致 |
| 神圣洗礼：信仰之翼 pc_awaken2（二觉） | ↓↑→→+Z；施放 0.5 s；守护路线二觉：圣力（50 s，最多 5 层）随辅助技能 / 命中叠加，每层荣誉祝福提高；对队友放神圣之光 = 信仰；勇气路线不能用；和惩罚共用冷却；CD 170 s（N / 视频 fNS2onOaXUc / CN 名） | 同；BUFF `pc_holy` 层数；`pcShareCd` 共用冷却 | 一致 |
| 惩罚 pc_punish（二觉） | ↑↑+Z；施放 0.5 s，无敌；升空后降下 24 段激光（越来越密、吸怪），落完或跳跃键落地终结爆炸；和信仰之翼共用冷却；CD 170 s（N / D） | 同；激光 75% 对准敌人（之前多数打空）、金色；跳跃键提前终结 | 一致 |
| 神之代行者 pc_agent | 三觉被动：攻击 / 体精提高；胜利之矛满蓄变大可引爆；圣光十字变大、命中处有 BUFF（N） | 同 | 一致 |
| 神罚之锤：天怒 pc_astrape | ↑↓→→+Z；瞬间；只能装备神罚之锤时用：划十字展光翼，高跳下劈：裂地冲击波 + 光之爆炸（1215 : 810）；按→ 跳得更远；光翼时 900 px 内队员信仰延长；CD 60 s（D / N） | 同；落地冲击波判定 [−120, 440]（贴身敌人不会被跳过去漏掉）、爆炸 240 px；体检另算光之复仇落雷 | 一致 |
| 生命礼赞：神威 pc_awaken3（三觉） | ←↑→↓+Z；瞬间，无敌；8 段同等伤害；联动天启之珠 = 神圣太阳 + 43 s BUFF（8+n%）；联动惩罚 = 20 s 额外 BUFF；勇气路线固定审判演出、无 BUFF；和联动的觉醒共用冷却；CD 270 s（N / CN 名） | 同；联动是 switchOpt（默认天启之珠）；联动觉醒冷却中三觉 req 挡住，反之亦然 | 一致 |

## 验证
- `node test/priest_crusader.mjs`、`node test/crusader.mjs mech,coop,shots` 全部通过（coop：荣誉祝福 / 守护徽章 / 圣光守护护盾 / 生命源泉复活 / 圣愈之风 / 天启之珠祝福都作用到 B）。
- `node test/skillaudit.mjs priest:crusader --compare`：24 个主动技能有规格，不一致 0。
- `node test/awkcancel.mjs priest:crusader`：切入觉醒 22 / 挡住 0（守护路线 6 个辅助技能在默认战斗路线下放不出，跳过）。
- `node test/skillshots.mjs priest:crusader`：32 个技能问题 0（守护路线技能在 `test/shots/crusader/support.jpg`）。
