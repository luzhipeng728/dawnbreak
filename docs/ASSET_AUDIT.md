# 素材盘点与瘦身（2026-09-30）

素材 = `art/final/**.webp`（构建时原样拷到 `dist/web/assets/`，按分包懒加载）。这次做了三件事：找出游戏从来不用的文件并删掉；把留下的文件在不改颜色、不改尺寸的前提下压小；部署只构建网页版。

## 0. 结论

| | 之前 | 之后 | 变化 |
|---|---:|---:|---:|
| art/final 文件数 | 10519 | 10310 | 删 209 |
| art/final 大小（文件字节） | 124.27 MiB | 103.46 MiB | −20.81 MiB（−16.7%） |
| art/final 占用磁盘（du） | 148.5 MiB | 126.6 MiB | −21.9 MiB |
| dist/web 占用磁盘（du，玩家要下载的全部） | 161.0 MiB | 138.4 MiB | −22.6 MiB（−14%） |
| dist/dawnbreak.html（离线单文件，部署不再生成） | 171.6 MiB | 143.8 MiB | −27.8 MiB |

- **删除 209 个没用的文件（2.28 MiB）**：76 个普通怪物精灵的 `idle2` / `taunt` 帧（152 个）、各职业 / 时装 / 拳上武器手臂层的 `victory` 帧（27 个）、机械师机器人 / 协战师战斗服 / 林中小屋没用的帧（18 个）、旧版 `x_*` 通用图标 8 个和 4 个废弃图（炫纹融合、格斗家徽记、魔法石任务图标、时装店建筑）。详见 §3。没有“疑似”留下。
- **瘦身 10184 个文件（−18.53 MiB，−15.2%）**：只重新压缩透明通道，**彩色部分逐字节不变、尺寸 / 锚点不变**，透明度误差 ≤ 4/255。详见 §6。
- **缺文件**：没有 bug 级的缺图；代码写死但没有文件的 4 个（魔道学者的毒云 / 冰云 / 火石 / 棒棒糖特效）和运行时探测的 69 个都有兜底（程序画 / 通用图），见 §5。另外看到 `world/g_white_ruins` 雪上有几块镂空（原图就有，切图时白雪被当成洞挖掉了，不是这次改的）。
- 验证：`node build.mjs`；受影响测试 fighter_looks / weapons / flow / ui（`test/affected.mjs`）+ avatar / jobvisuals 全部通过；改后用 1 个浏览器再跑一遍巡游（自己的巡游 + 天帷巨兽 + 希洛克区域怪物 / 场景），删掉的 key 一次都没被查 / 画，没有 404、没有“素材加载失败”；网页版目视抽查（4 个职业进城、地下城 / 深渊、背包、商城、6 张觉醒插图）和改前一致。

## 1. 怎么判断“没用”

工具：`node tools/asset_audit.mjs <static|data|trace|report|delete|spot>`（用法见文件头）。一个文件只有在下面三种来源**都**没有引用时才删；只剩弱证据的列进 §4“疑似”，不删。

1. **静态扫描（a）**：`src/**/*.js`（和 shell html）做一遍词法分析，取出所有字符串字面量、模板字符串、字符串拼接（`'icon/' + x`、`` `bg/${t}_floor` ``、`x + '_far'`）。匹配规则：
   - 整条 key 写死（`'fx/rune'`）→ 引用；
   - 名字出现过：非精灵文件看 `<分类>/` 后面的名字（`icon/wt_candy` 的 `wt_candy`），精灵帧要“目录名 + 帧名”都出现过（时装目录 `sword@sky1` 拆成 `sword` + `sky1`）；带数字尾巴的看词干（`seq('walk', 8)` → `walk1..8`、`'cutin/witch' + n`）；
   - 模板 / 拼接：洞只能填**已有的字符串或数字**（`` `pet/${id}_${f}` `` 要求 `id` 是出现过的名字、`f` 是数字）。洞随便填的“宽匹配”只算弱证据（§4）。只有分类前缀、其余全是变量的模板（`'fx/' + name`）宽匹配等于“整个分类”，不当证据——它的取值由名字规则和 (b) 负责。
2. **数据枚举（b）**：无头页面里取出全部顶层变量（从源码解析出约 3000 个名字），深度遍历收集运行时数据里出现的所有字符串（值和对象键，约 2.3 万个，里面有区域生成器算出来的物品 key、怪物美术表、动画表……），并用游戏自己的取图函数算 key：`itemArtKey` / `itemIconSrc`（每件物品 × 各品级）、`weaponArtOf`（每件武器 / 每种武器类型 × 品级 × 每款武器装扮 × 每个职业）、`jobArtKey`、`gateArt`、觉醒插图 `cutinWho` 的一 / 二 / 三觉候选。
   - **普通怪物的精灵帧另外收紧**：`MON_ART` 里的目录，如果目录名没有在“自己造精灵模型 / 直接取帧”的代码里出现过（转职、召唤物、外观、联机、界面、`summon.js`、天空之城的自定义模型），也没有 `spr:目录` 这样的直接引用，那它的模型一定是 `SpriteModel(目录, 怪物兜底表, SPR_ANIMS.monster)`，只能选到怪物动画表 / 兜底表里的帧。`idle2`、`taunt` 这两个名字在代码里是别的东西（姿势名、挑衅状态），不算这些目录的帧引用。借怪物帧的目录（哥布林、牛头、雪虎、召唤兽……共 25 个）不收紧。
3. **运行记录（c）**：`dist/web` 的页面打埋点（换掉 `IMG` / `ASSET_SRC` 为记录用的代理、包住 `drawImage` / `createPattern`、盯 DOM 里的 `<img>`），分包批量加载和 `tintImg` 的预先换色不算，真正画出来 / 显示出来 / 按 key 查过才算。每个测试用自己的页面路径，记录能分到具体测试上。巡游 = 44 次现成测试（skillshots 按职业拆成 4 次；bestiary 跑满 45 分钟被截断，它逐个过的怪物前面的区域测试都已覆盖）+ 自己的巡游，4 路并行约 50 分钟、共 2.2 万条记录：全职业全转职全部主动技能和觉醒（skillshots）、外观 / 时装 / 武器 / 转职外观、城镇场景 / NPC / 世界地图、老区域和 7 个新区域每个怪物和领主的每一招 + 场景 + 深渊、商城 / 背包 / 界面 / 任务、召唤类转职、决斗规则、手机操作；自己的巡游把每个地下城都进一次并切到领主房 / 精英房、背包塞满全部物品、打开各个窗口。
   - `test/avatar.mjs`、`test/fighter_looks.mjs` 会把职业的每一帧都画一遍查外观，只在这两个测试里画过的精灵帧不算“游戏用到”。

<!-- audit:start -->（下面 §2~§5 由 `node tools/asset_audit.mjs report --doc` 生成）

## 2. 按目录汇总（盘点时的 art/final）

| 目录 | 文件 | 大小 MiB | 没用（删除） | 删除 KiB | 疑似（留着） |
|---|---:|---:|---:|---:|---:|
| spr | 7850 | 78.57 | 197 | 2232 | 0 |
| bg | 183 | 12.47 | 0 | 0 | 0 |
| icon | 1525 | 9.41 | 11 | 48 | 0 |
| world | 163 | 6.76 | 1 | 55 | 0 |
| weapon | 438 | 6.11 | 0 | 0 | 0 |
| cutin | 50 | 4.68 | 0 | 0 | 0 |
| fx | 103 | 2.41 | 0 | 0 | 0 |
| job | 19 | 2.29 | 0 | 0 | 0 |
| cash | 119 | 0.50 | 0 | 0 | 0 |
| aura | 5 | 0.37 | 0 | 0 | 0 |
| (根目录) | 1 | 0.25 | 0 | 0 | 0 |
| pet | 24 | 0.22 | 0 | 0 | 0 |
| class | 4 | 0.13 | 0 | 0 | 0 |
| avatar | 35 | 0.10 | 0 | 0 | 0 |
| **合计** | 10519 | 124.27 | 209 | 2335 | 0 |

## 3. 删除清单

### 3.1 最大的 30 个

| 文件 | KB | 为什么没用 |
|---|---:|---|
| `world/b_boutique` | 55 | 城镇建筑“时装店”（art/tools/jobs.py 出的图），没有摆进任何场景 |
| `spr/lotus/taunt` | 30 | 目录 lotus 只当普通怪物用（MON_ART），帧 taunt 不在 SPR_ANIMS.monster / 兜底表里 |
| `spr/rodin/taunt` | 28 | 目录 rodin 只当普通怪物用（MON_ART），帧 taunt 不在 SPR_ANIMS.monster / 兜底表里 |
| `spr/snSkasa/idle2` | 27 | 目录 snSkasa 只当普通怪物用（MON_ART），帧 idle2 不在 SPR_ANIMS.monster / 兜底表里 |
| `spr/snSkasa/taunt` | 25 | 目录 snSkasa 只当普通怪物用（MON_ART），帧 taunt 不在 SPR_ANIMS.monster / 兜底表里 |
| `spr/lotus/idle2` | 25 | 目录 lotus 只当普通怪物用（MON_ART），帧 idle2 不在 SPR_ANIMS.monster / 兜底表里 |
| `spr/rodin/idle2` | 24 | 目录 rodin 只当普通怪物用（MON_ART），帧 idle2 不在 SPR_ANIMS.monster / 兜底表里 |
| `spr/yakshaKing/taunt` | 23 | 目录 yakshaKing 只当普通怪物用（MON_ART），帧 taunt 不在 SPR_ANIMS.monster / 兜底表里 |
| `spr/wcBugKing/idle2` | 22 | 目录 wcBugKing 只当普通怪物用（MON_ART），帧 idle2 不在 SPR_ANIMS.monster / 兜底表里 |
| `spr/mech_g0/aim` | 22 | gun_mechanic.js 的机器人外观 mechFrame() 只取 MECH_LOOK 里写死的帧名，没有这一帧 |
| `spr/yakshaKing/idle2` | 22 | 目录 yakshaKing 只当普通怪物用（MON_ART），帧 idle2 不在 SPR_ANIMS.monster / 兜底表里 |
| `spr/gtMech/idle2` | 21 | 目录 gtMech 只当普通怪物用（MON_ART），帧 idle2 不在 SPR_ANIMS.monster / 兜底表里 |
| `spr/deSpiz/idle2` | 21 | 目录 deSpiz 只当普通怪物用（MON_ART），帧 idle2 不在 SPR_ANIMS.monster / 兜底表里 |
| `spr/deSpiz/taunt` | 21 | 目录 deSpiz 只当普通怪物用（MON_ART），帧 taunt 不在 SPR_ANIMS.monster / 兜底表里 |
| `spr/wcBugKing/taunt` | 20 | 目录 wcBugKing 只当普通怪物用（MON_ART），帧 taunt 不在 SPR_ANIMS.monster / 兜底表里 |
| `spr/donnierEX/taunt` | 20 | 目录 donnierEX 只当普通怪物用（MON_ART），帧 taunt 不在 SPR_ANIMS.monster / 兜底表里 |
| `spr/donnierEX/idle2` | 20 | 目录 donnierEX 只当普通怪物用（MON_ART），帧 idle2 不在 SPR_ANIMS.monster / 兜底表里 |
| `spr/marcel/taunt` | 19 | 目录 marcel 只当普通怪物用（MON_ART），帧 taunt 不在 SPR_ANIMS.monster / 兜底表里 |
| `spr/gtMech/taunt` | 19 | 目录 gtMech 只当普通怪物用（MON_ART），帧 taunt 不在 SPR_ANIMS.monster / 兜底表里 |
| `spr/highPriest/taunt` | 19 | 目录 highPriest 只当普通怪物用（MON_ART），帧 taunt 不在 SPR_ANIMS.monster / 兜底表里 |
| `spr/bmMechTau/taunt` | 18 | 目录 bmMechTau 只当普通怪物用（MON_ART），帧 taunt 不在 SPR_ANIMS.monster / 兜底表里 |
| `spr/treant/taunt` | 18 | 目录 treant 只当普通怪物用（MON_ART），帧 taunt 不在 SPR_ANIMS.monster / 兜底表里 |
| `spr/tgCerberus/idle2` | 18 | 目录 tgCerberus 只当普通怪物用（MON_ART），帧 idle2 不在 SPR_ANIMS.monster / 兜底表里 |
| `spr/tgSkelKnight/idle2` | 17 | 目录 tgSkelKnight 只当普通怪物用（MON_ART），帧 idle2 不在 SPR_ANIMS.monster / 兜底表里 |
| `spr/snCharlie/taunt` | 17 | 目录 snCharlie 只当普通怪物用（MON_ART），帧 taunt 不在 SPR_ANIMS.monster / 兜底表里 |
| `spr/bmMechTau/idle2` | 17 | 目录 bmMechTau 只当普通怪物用（MON_ART），帧 idle2 不在 SPR_ANIMS.monster / 兜底表里 |
| `spr/tgUtara/idle2` | 17 | 目录 tgUtara 只当普通怪物用（MON_ART），帧 idle2 不在 SPR_ANIMS.monster / 兜底表里 |
| `spr/tgCerberus/taunt` | 17 | 目录 tgCerberus 只当普通怪物用（MON_ART），帧 taunt 不在 SPR_ANIMS.monster / 兜底表里 |
| `spr/highPriest/idle2` | 16 | 目录 highPriest 只当普通怪物用（MON_ART），帧 idle2 不在 SPR_ANIMS.monster / 兜底表里 |
| `spr/archbishop/idle2` | 16 | 目录 archbishop 只当普通怪物用（MON_ART），帧 idle2 不在 SPR_ANIMS.monster / 兜底表里 |

### 3.2 全部 209 个（按目录，2.28 MiB，每项后面是 KiB）

没写原因的都是普通怪物目录的 `idle2` / `taunt`：目录只当普通怪物用（MON_ART），这两帧不在 `SPR_ANIMS.monster` / 怪物兜底表里（见 §1 第 2 条）。

- `world`（1 个，55 KiB）：b_boutique 55 —— 城镇建筑“时装店”（art/tools/jobs.py 出的图），没有摆进任何场景
- `spr/lotus`（2 个，55 KiB）：idle2 25、taunt 30
- `spr/snSkasa`（2 个，53 KiB）：idle2 27、taunt 25
- `spr/rodin`（2 个，52 KiB）：idle2 24、taunt 28
- `icon`（11 个，48 KiB）：bm_fusion 5、f_emblem 5、q_magic_stone 5、x_bag 4、x_bomb 4、x_chest 5、x_enh 4、x_hp 4、x_mp 4、x_shield 4、x_skull 4
- `spr/yakshaKing`（2 个，44 KiB）：idle2 22、taunt 23
- `spr/wcBugKing`（2 个，43 KiB）：idle2 22、taunt 20
- `spr/deSpiz`（2 个，42 KiB）：idle2 21、taunt 21
- `spr/donnierEX`（2 个，41 KiB）：idle2 20、taunt 20
- `spr/gtMech`（2 个，41 KiB）：idle2 21、taunt 19
- `spr/marcel`（2 个，36 KiB）：idle2 16、taunt 19
- `spr/bmMechTau`（2 个，35 KiB）：idle2 17、taunt 18
- `spr/highPriest`（2 个，35 KiB）：idle2 16、taunt 19
- `spr/tgCerberus`（2 个，34 KiB）：idle2 18、taunt 17
- `spr/treant`（2 个，34 KiB）：idle2 16、taunt 18
- `spr/tgSkelKnight`（2 个，33 KiB）：idle2 17、taunt 16
- `spr/snCharlie`（2 个，33 KiB）：idle2 15、taunt 17
- `spr/archbishop`（2 个，32 KiB）：idle2 16、taunt 16
- `spr/tgUtara`（2 个，32 KiB）：idle2 17、taunt 16
- `spr/snBwanga`（2 个，31 KiB）：idle2 16、taunt 16
- `spr/gatekeeper`（2 个，31 KiB）：idle2 16、taunt 15
- `spr/deGiant`（2 个，31 KiB）：idle2 15、taunt 16
- `spr/deBoroding`（2 个，30 KiB）：idle2 16、taunt 15
- `spr/trAnzu`（2 个，29 KiB）：idle2 15、taunt 14
- `spr/trMobeni`（2 个，28 KiB）：idle2 14、taunt 15
- `spr/tauArmored`（2 个，27 KiB）：idle2 14、taunt 14
- `spr/trFishman`（2 个，27 KiB）：idle2 14、taunt 13
- `spr/trPodir`（2 个，26 KiB）：idle2 15、taunt 12
- `spr/trFladin`（2 个，26 KiB）：idle2 13、taunt 13
- `spr/tgIris`（2 个，26 KiB）：idle2 13、taunt 13
- `spr/tgBelit`（2 个，26 KiB）：idle2 13、taunt 13
- `spr/deHeadless`（2 个，26 KiB）：idle2 13、taunt 12
- `spr/gtTank`（2 个，26 KiB）：idle2 13、taunt 13
- `spr/assassin`（2 个，25 KiB）：idle2 12、taunt 13
- `spr/jailer`（2 个，24 KiB）：idle2 12、taunt 13
- `spr/yaksha`（2 个，24 KiB）：idle2 12、taunt 12
- `spr/nmRatman`（2 个，24 KiB）：idle2 13、taunt 11
- `spr/gtSuleide`（2 个，24 KiB）：idle2 11、taunt 13
- `spr/deMorgan`（2 个，24 KiB）：idle2 11、taunt 12
- `spr/nex`（2 个，23 KiB）：idle2 11、taunt 12
- `spr/siroco`（2 个，23 KiB）：idle2 11、taunt 12
- `spr/snBantu`（2 个，23 KiB）：idle2 12、taunt 11
- `spr/nmPiper`（2 个，23 KiB）：idle2 11、taunt 12
- `spr/nmDogman`（2 个，23 KiB）：idle2 11、taunt 11
- `spr/gtBentink`（2 个，22 KiB）：idle2 11、taunt 12
- `spr/mech_g0`（1 个，22 KiB）：aim 22 —— gun_mechanic.js 的机器人外观 mechFrame() 只取 MECH_LOOK 里写死的帧名，没有这一帧
- `spr/wcKain`（2 个，22 KiB）：idle2 10、taunt 11
- `spr/voidcaster`（2 个，22 KiB）：idle2 11、taunt 11
- `spr/boneLord`（2 个，22 KiB）：idle2 10、taunt 11
- `spr/deDiregie`（2 个，21 KiB）：idle2 11、taunt 11
- `spr/gbl`（2 个，21 KiB）：idle2 10、taunt 11
- `spr/pmsuit`（2 个，21 KiB）：aimUp 11、victory 10 —— 协战师战斗服的动画表 pmAnims()（gun_paramedic.js）没有这一帧
- `spr/deSkel`（2 个，21 KiB）：idle2 9、taunt 11
- `spr/deElf`（2 个，20 KiB）：idle2 11、taunt 10
- `spr/siPhantom`（2 个，20 KiB）：idle2 9、taunt 10
- `spr/snRose`（2 个，20 KiB）：idle2 10、taunt 10
- `spr/trMermaid`（2 个，19 KiB）：idle2 10、taunt 9
- `spr/zombie`（2 个，19 KiB）：idle2 8、taunt 11
- `spr/sawCart`（2 个，19 KiB）：idle2 9、taunt 10
- `spr/nmBandit`（2 个，19 KiB）：idle2 9、taunt 10
- `spr/dragonCannon`（2 个，19 KiB）：idle2 9、taunt 9
- `spr/catKing`（2 个，18 KiB）：idle2 9、taunt 9
- `spr/goblinShaman`（2 个，18 KiB）：idle2 8、taunt 9
- `spr/gtSoldier`（2 个，17 KiB）：idle2 8、taunt 9
- `spr/tgNilbas`（2 个，17 KiB）：idle2 8、taunt 9
- `spr/deGhoul`（2 个，16 KiB）：idle2 8、taunt 8
- `spr/snYeti`（2 个，16 KiB）：idle2 8、taunt 8
- `spr/hound`（2 个，16 KiB）：idle2 8、taunt 8
- `spr/donnier`（2 个，16 KiB）：idle2 8、taunt 8
- `spr/mech_factory`（2 个，15 KiB）：peek 7、work 8 —— gun_mechanic.js 的机器人外观 mechFrame() 只取 MECH_LOOK 里写死的帧名，没有这一帧
- `spr/deSpider`（2 个，14 KiB）：idle2 8、taunt 7
- `spr/snToy`（2 个，14 KiB）：idle2 7、taunt 8
- `spr/flower`（2 个，14 KiB）：idle2 7、taunt 7
- `spr/octopus`（2 个，14 KiB）：idle2 7、taunt 7
- `spr/gazer`（2 个，14 KiB）：idle2 7、taunt 7
- `spr/bmIvan`（2 个，13 KiB）：idle2 6、taunt 7
- `spr/goblinChief`（2 个，12 KiB）：idle2 6、taunt 6
- `spr/deGhost`（2 个，12 KiB）：idle2 6、taunt 6
- `spr/mech_viper`（3 个，11 KiB）：aimDown 4、aimUp 4、fold 3 —— gun_mechanic.js 的机器人外观 mechFrame() 只取 MECH_LOOK 里写死的帧名，没有这一帧
- `spr/nmRat`（2 个，11 KiB）：idle2 6、taunt 6
- `spr/gun@festival`（1 个，11 KiB）：victory 11 —— 游戏里没有“胜利”片段：代码和数据里都没有 victory 这个帧名
- `spr/gun@sky1`（1 个，11 KiB）：victory 11 —— 游戏里没有“胜利”片段：代码和数据里都没有 victory 这个帧名
- `spr/wcLarva`（2 个，11 KiB）：idle2 6、taunt 5
- `spr/thornhut`（1 个，11 KiB）：wither 11 —— 林中小屋（mage_enchantress.js enFrame）只取 idle / 摇晃 / 倒塌帧，没有这一帧
- `spr/gun@summer`（1 个，11 KiB）：victory 11 —— 游戏里没有“胜利”片段：代码和数据里都没有 victory 这个帧名
- `spr/fighter@sky1`（1 个，11 KiB）：victory 11 —— 游戏里没有“胜利”片段：代码和数据里都没有 victory 这个帧名
- `spr/fighter@sky2`（1 个，11 KiB）：victory 11 —— 游戏里没有“胜利”片段：代码和数据里都没有 victory 这个帧名
- `spr/gun@spring`（1 个，11 KiB）：victory 11 —— 游戏里没有“胜利”片段：代码和数据里都没有 victory 这个帧名
- `spr/bmRobot`（2 个，11 KiB）：idle2 5、taunt 6
- `spr/mage`（1 个，10 KiB）：victory 10 —— 游戏里没有“胜利”片段：代码和数据里都没有 victory 这个帧名
- `spr/gun@sky2`（1 个，10 KiB）：victory 10 —— 游戏里没有“胜利”片段：代码和数据里都没有 victory 这个帧名
- `spr/gun@academy`（1 个，10 KiB）：victory 10 —— 游戏里没有“胜利”片段：代码和数据里都没有 victory 这个帧名
- `spr/fighter@summer`（1 个，10 KiB）：victory 10 —— 游戏里没有“胜利”片段：代码和数据里都没有 victory 这个帧名
- `spr/mage@sky2`（1 个，10 KiB）：victory 10 —— 游戏里没有“胜利”片段：代码和数据里都没有 victory 这个帧名
- `spr/gun`（1 个，10 KiB）：victory 10 —— 游戏里没有“胜利”片段：代码和数据里都没有 victory 这个帧名
- `spr/fighter@spring`（1 个，10 KiB）：victory 10 —— 游戏里没有“胜利”片段：代码和数据里都没有 victory 这个帧名
- `spr/mage@spring`（1 个，10 KiB）：victory 10 —— 游戏里没有“胜利”片段：代码和数据里都没有 victory 这个帧名
- `spr/mage@festival`（1 个，10 KiB）：victory 10 —— 游戏里没有“胜利”片段：代码和数据里都没有 victory 这个帧名
- `spr/fighter@festival`（1 个，10 KiB）：victory 10 —— 游戏里没有“胜利”片段：代码和数据里都没有 victory 这个帧名
- `spr/mage@sky1`（1 个，9 KiB）：victory 9 —— 游戏里没有“胜利”片段：代码和数据里都没有 victory 这个帧名
- `spr/fighter@academy`（1 个，9 KiB）：victory 9 —— 游戏里没有“胜利”片段：代码和数据里都没有 victory 这个帧名
- `spr/mage@summer`（1 个，9 KiB）：victory 9 —— 游戏里没有“胜利”片段：代码和数据里都没有 victory 这个帧名
- `spr/mage@academy`（1 个，9 KiB）：victory 9 —— 游戏里没有“胜利”片段：代码和数据里都没有 victory 这个帧名
- `spr/fighter`（1 个，9 KiB）：victory 9 —— 游戏里没有“胜利”片段：代码和数据里都没有 victory 这个帧名
- `spr/mech_g2`（3 个，5 KiB）：aim 2、tiltB 2、tiltF 2 —— gun_mechanic.js 的机器人外观 mechFrame() 只取 MECH_LOOK 里写死的帧名，没有这一帧
- `spr/mech_g1`（1 个，4 KiB）：aimUp 4 —— gun_mechanic.js 的机器人外观 mechFrame() 只取 MECH_LOOK 里写死的帧名，没有这一帧
- `spr/mech_falcon`（1 个，4 KiB）：glide 4 —— gun_mechanic.js 的机器人外观 mechFrame() 只取 MECH_LOOK 里写死的帧名，没有这一帧
- `spr/mech_buster`（1 个，3 KiB）：brake 3 —— gun_mechanic.js 的机器人外观 mechFrame() 只取 MECH_LOOK 里写死的帧名，没有这一帧
- `spr/mech_rx78`（1 个，3 KiB）：brake 3 —— gun_mechanic.js 的机器人外观 mechFrame() 只取 MECH_LOOK 里写死的帧名，没有这一帧
- `spr/mech_emgen`（1 个，3 KiB）：fold 3 —— gun_mechanic.js 的机器人外观 mechFrame() 只取 MECH_LOOK 里写死的帧名，没有这一帧
- `spr/farm_knuckle`（1 个，2 KiB）：victory 2 —— 游戏里没有“胜利”片段：代码和数据里都没有 victory 这个帧名
- `spr/farm_gauntlet`（1 个，2 KiB）：victory 2 —— 游戏里没有“胜利”片段：代码和数据里都没有 victory 这个帧名
- `spr/mech_g3`（1 个，2 KiB）：glide 2 —— gun_mechanic.js 的机器人外观 mechFrame() 只取 MECH_LOOK 里写死的帧名，没有这一帧
- `spr/mech_frisbee`（1 个，2 KiB）：tilt 2 —— gun_mechanic.js 的机器人外观 mechFrame() 只取 MECH_LOOK 里写死的帧名，没有这一帧
- `spr/farm_tonfa`（1 个，2 KiB）：victory 2 —— 游戏里没有“胜利”片段：代码和数据里都没有 victory 这个帧名
- `spr/farm_boxing`（1 个，2 KiB）：victory 2 —— 游戏里没有“胜利”片段：代码和数据里都没有 victory 这个帧名
- `spr/farm_claw`（1 个，1 KiB）：victory 1 —— 游戏里没有“胜利”片段：代码和数据里都没有 victory 这个帧名

## 4. 疑似未用（0 个，留着没删）

没有：凡是只剩“模板宽匹配”这种弱证据的，都已按具体规则（洞必须能用已有的字符串 / 数字填上）判定。


## 5. 代码要、但 art/final 里没有的文件

### 5.1 代码里写死的 key（4 个，都有兜底，缺的是美术）

- `fx/wt_frostcloud`：src/content/classes/mage_witch.js:353（运行时也查过） —— mage_witch.js：没有图就用 fxTint / fireball / orb 代替（美术没出）
- `fx/wt_cloud`：src/content/classes/mage_witch.js:353 —— mage_witch.js：没有图就用 fxTint / fireball / orb 代替（美术没出）
- `fx/wt_firestone`：src/content/classes/mage_witch.js:472 —— mage_witch.js：没有图就用 fxTint / fireball / orb 代替（美术没出）
- `fx/wt_lollipop`：src/content/classes/mage_witch.js:683（运行时也查过） —— mage_witch.js：没有图就用 fxTint / fireball / orb 代替（美术没出）

### 5.2 spr.json 里有帧、但没有图（0 个）

没有。

### 5.3 运行时按 key 查过 / 取图函数的候选，但没有文件（69 个，都是“有专属图就用，没有就退回通用图 / 程序画”的探测）

- content/abyss.js 给深渊复制背景时 5 种图层逐个查，mid / fore 本来就没有（手绘背景只有 far / floor / edge）（20 个）：`bg/ruinsDark_mid` `bg/ruinsDark_fore` `bg/skyDark_mid` `bg/skyDark_fore` `bg/bhSpine_mid` `bg/bhSpine_fore` `bg/bhForbidden_mid` `bg/bhForbidden_fore` `bg/deGate_mid` `bg/deGate_fore` `bg/snPalace_mid` `bg/snPalace_fore` `bg/nmHamelin_mid` `bg/nmHamelin_fore` `bg/trHeis_mid` `bg/trHeis_fore` `bg/tgRift_mid` `bg/tgRift_fore` `bg/siroPain_mid` `bg/siroPain_fore`
- 深渊主题先查自己的背景，没有就借普通主题的（content/abyss.js）（22 个）：`bg/abyssGF_far` `bg/abyssSky_far` `bg/abyssSpine_far` `bg/abyssForbidden_far` `bg/abyssDarkelf_far` `bg/abyssSnow_far` `bg/abyssNorsemar_far` `bg/abyssTrain_far` `bg/abyssTimegate_far` `bg/abyssSiroco_far` `bg/abyssSiroco_floor` `bg/abyssSiroco_edge` `bg/abyssDarkelf_floor` `bg/abyssDarkelf_edge` `bg/abyssSnow_floor` `bg/abyssSnow_edge` `bg/abyssNorsemar_floor` `bg/abyssNorsemar_edge` `bg/abyssTrain_floor` `bg/abyssTrain_edge` `bg/abyssTimegate_floor` `bg/abyssTimegate_edge`
- fighter_nen.js fnBeast：念兽有素材就画素材，没有就程序画发光兽形（素材没出）（5 个）：`fx/fn_beast_head` `fx/fn_beast_tiger` `fx/fn_beast_haitai` `fx/fn_beast_idle` `fx/fn_beast_lion`
- mage_witch.js craftPop：使魔结果表情有图标就用，没有就画带颜色的小圆牌（图标没出）（10 个）：`icon/wt_fam_jack_super` `icon/wt_fam_eel_super` `icon/wt_fam_cat_great` `icon/wt_fam_jack_fail` `icon/wt_fam_snow_great` `icon/wt_fam_eel_great` `icon/wt_fam_cat_fail` `icon/wt_fam_cat_super` `icon/wt_fam_snow_fail` `icon/wt_fam_jack_great`
- summon.js summonLoadArt 用 spr/<分包>/idle 判断分包是否已加载；幻鬼（phantom）的站姿帧叫 pfloat、没有 idle，所以每次召唤都会再调一次 loadBundles（功能正常，只是多做一次空加载）（1 个）：`spr/phantom/idle`
- cutinWho（common.js）：二觉 / 三觉有专属插图就用，没有就用一觉的（10 个）：`cutin/blade2` `cutin/blade3` `cutin/berserker2` `cutin/berserker3` `cutin/asura2` `cutin/asura3` `cutin/soulbender2` `cutin/soulbender3` `cutin/ghostblade2` `cutin/ghostblade3`
- hud.js 觉醒插图按 cutin/<职业或转职> 取；格斗家没有基础职业的插图（鬼剑士 / 神枪手 / 魔法师有），没有就画人物模型（1 个）：`cutin/fighter`

<!-- audit:end -->

## 6. 瘦身（`python3 art/tools/asset_shrink.py`）

**先量再决定压哪里**：所有文件都是有损 WebP（VP8 + 透明通道 ALPH），彩色部分的量化等级已经在 76~90 质量之间（精灵 ≈ 80、图标 / 武器 ≈ 90）；透明通道是无损压缩，却占精灵文件的 36%、特效的 60%。

1. **透明通道（做了）**：几乎透明 / 几乎不透明的像素（≤4 / ≥251）归到 0 / 255，人物、图标、武器、插图、特效再把半透明值对齐到 8 的倍数（透明度误差最多 4/255 = 1.6%，比彩色部分有损压缩本身的误差小）；背景和城镇建筑有大片柔和阴影，只归整不对齐。然后无损重新压缩 ALPH 块，**VP8 彩色块原样拼回去**——颜色逐字节不变，尺寸、spr.json 锚点都不用动。每个文件拼好后都解码核对（颜色全等、透明度等于处理后的值），10184 个全部通过。

   | 目录 | 文件 | 之前 MiB | 之后 MiB | 省 | 透明度处理 |
   |---|---:|---:|---:|---:|---|
   | spr | 7653 | 76.39 | 62.38 | −18.3% | 8 级对齐 |
   | bg | 183 | 12.47 | 12.19 | −2.2% | 只归整（122 张远景 / 地面没有透明通道） |
   | icon | 1514 | 9.37 | 8.19 | −12.5% | 8 级对齐 |
   | world | 162 | 6.70 | 6.19 | −7.6% | 只归整 |
   | weapon | 438 | 6.11 | 5.16 | −15.5% | 8 级对齐 |
   | cutin | 50 | 4.68 | 4.24 | −9.5% | 8 级对齐 |
   | fx | 103 | 2.41 | 1.69 | −30.0% | 8 级对齐 |
   | job | 19 | 2.29 | 2.04 | −11.2% | 8 级对齐 |
   | cash / aura / pet / class / avatar / title | 188 | 1.57 | 1.37 | −13% | 8 级对齐（title 没有透明通道） |
   | **合计**（不含删掉的） | 10310 | 121.99 | 103.46 | **−15.2%** | |

   对比图（原图 \| 新图，棋盘格和深色底各一对，最后一格是差异 ×16）：`art/work/asset_audit/cmp_<分类>.jpg`，每类抽 4 张（省得最多的 2 张 + 随机 2 张）；特效光晕另外按正常 / 叠加两种混合在深色底上对比：`cmp_fx_blend.jpg`。肉眼看不出差别，差异 ×16 后只剩边缘一圈细线。尺寸报告 `art/work/asset_audit/shrink_report.json`（每个文件原始大小 → 现在大小）。
2. **缩小尺寸（量了，不做）**：运行记录里量了每张图画到屏幕上的最大放大倍数（世界层按 1920×1080 的实际画布；界面按最大情况——逻辑 1920 宽 × 2 倍像素）：精灵帧中位数 1.15、最大 3.45，背景 1.0~1.33，觉醒插图 2.17（本来就偏小），标题 1.06，都不能缩（精灵帧也不许缩，锚点按帧像素算）。图标、武器、宠物、时装配件大多先画进离屏缓存（量不准），按界面尺寸估算：128 px 的图标在最大情况下的格子里约 100 px、提示框里更大，武器按 3 倍存、时装窗口里放大画。真正画得小的只有 30 个城镇摆件（`world/p_*`，最大只画到 0.19~0.47 倍），合计 0.63 MiB，缩了也省不到 0.5 MiB，不值得冒险。
3. **彩色部分重压（试了，不做）**：图标 / 武器 / 转职立绘从 ≈90 质量重压到 82 只省 11~15%，而且是第二代有损（和原图的 PSNR 35~40 dB）；精灵本来就在 ≈80，再压会看得出来。

## 7. 以后

- 盘点重跑：`node build.mjs && node tools/asset_audit.mjs data && PAR=4 node tools/asset_audit.mjs trace`（约 50 分钟，跑的时候别重新构建）`&& node tools/asset_audit.mjs report --doc`；删除 `node tools/asset_audit.mjs delete`（`git rm`，历史里还在；精灵帧同时从 spr.json 去掉）。
- 瘦身重跑：`python3 art/tools/asset_shrink.py`（幂等：处理过的文件再跑不会变；新加的素材会被处理），对比图 `python3 art/tools/asset_shrink.py compare`。新出的美术进 art/final 之后跑一次就行。
- 区域流水线切怪物帧时还会切出 `idle2` / `taunt`，普通怪物用不到；以后可以让 `region_art.py` 不输出这两帧，或者每做完一个区域跑一次 `asset_audit.mjs`。
- 部署：`sh tools/deploy.sh web` 现在只构建网页版（`node build.mjs --web`），不再写 175 MB 的离线单文件；测试默认读单文件，`quick.sh` / `all.sh` 自己会全量构建。
