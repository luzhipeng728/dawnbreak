# 转职外观（JOB_VISUALS）

转职后一眼看出是谁：常驻外观（鬼手 / 红眼 / 小鬼神…）+ 状态特效（BUFF / 阵 / 无敌）。全部是**运行时覆盖层**，叠在人物帧上面，所以任何时装、混搭都能用；城镇、地下城、选角、个人信息、决斗、其他玩家、组队影子、AI 对手都一样。

## 1. 官方依据与规格（阶段 A：鬼泣、狂战士）

| 转职 | 官方特征（国服 / namu） | 我们的做法 |
|---|---|---|
| 鬼泣 | 解开封印的左臂「鬼手」冒紫色鬼火，鬼神随身 | 副手（F.oh）上 2 条紫色鬼火舌 + 往上飘的光点；后背肩膀上方一只小鬼神（fx/jv_wisp）慢慢浮动 |
| 鬼泣 · 残影之凯贾（俗称鬼影步） | 「前冲的一定时间内进入无敌状态（1 秒）」；凯贾附身，身后有鬼影 | 身后跟着自己的紫色剪影（移动时拖远）；移动时 0.25 秒残影；**无敌时本体半透明（alpha ≈ 0.45）+ 鬼火微光**。机制：凯贾时开始跑动 → 1 秒无敌（每 3 秒一次，`sword_soul.js`） |
| 鬼泣 · 阵（萨亚 / 普戾蒙 / 罗刹） | 鬼神在场 | 阵在场时身边 2~4 只鬼火绕身体转（转到身后的那一半画在人物后面）——「鬼影重重」 |
| 狂战士（红眼） | 红眼、血红的鬼手 | 眼睛红光，移动时往后拖一道红光；副手血气火舌 + 往下滴血 |
| 狂战士 · 狂暴之力（血之狂暴） | 开启后全身血气燃烧，双刀流 | 身后一团血雾 + 红色外轮廓 + 沿身体两侧和头顶往上窜的血焰，身前再补几条小火舌；武器（含二刀流的副手刀）外圈染红光 |
| 狂战士 · 暴走 | 更强的血气 | 同上，强度 2：火更大、更多 |
| 狂战士 · 出血命中 | 出血 | 命中时溅血花（`jobFxBlood`，同一目标 0.15 秒一次） |
| 阿修罗 | 眼罩 | X 形眼罩（原来只有自己看得到，现在 look.acc 带着，其他玩家也看得到） |

阶段 B（其余 12 个转职）按第 3 节的配方各加一条。

## 2. 代码结构

| 文件 | 内容 |
|---|---|
| `src/content/avatar/job_looks.js` | `JOB_LOOKS[转职] = { 数据 }`（字段说明见文件头）+ `jobLookAcc`（转职配件并进 look.acc） |
| `src/models/job_fx.js` | 渲染器：`jlUnder`（身后 / 半透明）、`jlOver`（身前）、`jlWeapon`（武器染色）、组件 `jlArm / jlEyes / jlGhost / jlTrail / jlWisps / jlBurn`、`jobFxBlood` |
| `src/models/avatar.js` | 外观层 `under` 开头调 `jlUnder`，`over` 结尾调 `jlOver`，`weapon` 在武器图之前调 `jlWeapon` |
| `src/content/avatar/looks.js` | `lookFromEquip(cls, eq, prefer, job)` 写 `look.job`（自己 = game.job；选角 = 存档里那个角色的 job） |
| `art/tools/avatar_hands.py` | 每帧副手锚点 `F.oh`（手套颜色找色块，去掉武器握点 / 靴子 / 腰带 / 头）；新动作帧切好后重跑 |
| `art/tools/jobvis_art.py` | 特效素材条（`fx/jv_flame` 4 格火舌、`fx/jv_wisp` 3 格鬼火精灵）：`gen` 生图 → `prep` 切条 |

- **转职从哪来**：`look.job`（自己 / 联机发来的 look）> 实体的 `kit.job`（AI、组队影子）。城镇里其他玩家没有实体 → 只画常驻外观，不画状态。
- **状态**：每帧 `S.on(e)` 返回强度（0 = 没开），读 `e.buffs` / 召唤物 / `e.invul`。
- **半透明**：`jlUnder` 在画本体之前把 `globalAlpha` 乘上去，`SpriteModel.draw` 的 save/restore 自动还原；超级霸体的离屏合成也照样生效。
- **性能**：不用 filter / shadowBlur，混合只用 source-over / lighter；剪影按（帧图, 颜色）缓存（LRU 160 张），火舌 / 鬼火是 fxTint 缓存的素材条。实测城镇 8 人（转职外观 + +13~+16 + 天空套）60 fps，地下城 4 个开状态的鬼剑士打怪 60 fps。

## 3. 新增一个转职（配方）

1. `JOB_LOOKS` 加一条：选颜色，挑组件（`arm / eyes / spirit / acc` 常驻；`states` 里 `ghost / trail / fade / wisps / burn / wtint`），参数照着鬼泣 / 狂战士改。
2. 组件不够用 → 写 `draw(c, L, F, f, back, e)` 钩子（坐标 = 帧像素，原点脚底，人物朝右，`back` 区分身前身后）；能复用就把它提成新组件放进 `job_fx.js`。
3. 要新素材（背后的大件、专属火焰）→ `jobvis_art.py` 的 `FX` 加一行，`gen` → `prep`，`job_fx.js` 的 `JL_STRIP` 登记格数、`FX_BASE_HUE` 登记本色。
4. 其他职业（gun / mage）第一次用 `arm` / `eyes`：先跑 `avatar_hands.py <职业> --sheet 预览.jpg`（`GLOVE` 里加手套颜色）、在 `JL_EYE` 里加眼睛偏移。
5. `node test/jobvisuals.mjs shots` 出总览图（原始 1 倍大小，城镇 + 地下城，默认 + 混搭时装）；`test/jobvisuals.mjs` 的检查会自动覆盖新条目（look.job / 配件）。

## 4. 强化光效（面子系统，game/vanity.js）

光效分两次画：武器图**之前**画光晕、爆闪的光、电弧（刀身挡在前面，只从外沿露出来）；武器图**之后**只画刀身外沿的火花和尖端星芒。外圈半径 × `VANITY_HALO_K`（0.7），火花数 × `VANITY_SPARK_K`（0.5）。+12~+16 也看得清武器轮廓。
