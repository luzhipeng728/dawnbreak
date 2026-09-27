# 破晓地下城 · 内容扩展指南（世界与美术）

本文说明如何新增城镇、区域场景、NPC、地下城门，以及美术怎么生成、处理和分包。
代码都在 `src/content/world/*.js`，引擎在 `src/game/world.js`，世界地图在 `src/ui/worldmap.js`。

每次改完请执行：
- `node build.mjs`
- `node test/world.mjs`
- `node test/flow.mjs`

启动时的内容校验 `validateWorld()` 会检查以下问题：
- 出口单向
- NPC、地下城没放进任何场景，或引用了不存在的 id
- 缺少美术素材
- 从出生点走不到的场景

在本地文件、localhost 或带 `?dev` 参数时，问题会用 `console.error` 报出来。`test/world.mjs` 发现任何一条都会失败。

## 1. 现在的世界（官方经典版布局）

```
赛丽亚的房间(seria_room) ─ 出门 ─ 艾尔文防线·集市(elvenguard) ─右→ 洛兰(gf_lorien：洛兰 / 洛兰深处)
                                     │左（Lv.3）
                              赫顿玛尔·市政街(hendon_myre)
                                     │左
 格兰之森·幽暗密林(gf_forest) ←左─ 赫顿玛尔·中央广场(hm_plaza) ─下→ 后街(hm_backstreet)
   │左                                 │上
 格兰之森·雷鸣废墟(gf_thunder)     赫顿玛尔·旧城区(hm_oldtown) ─左→ 西海岸·商贸区(west_coast) ─左→ 魔法师公会(wc_guild)
   │左
 格兰之森·格拉卡(gf_graca)
```

官方依据：
- 艾尔文防线集市向左是赫顿玛尔市政街（Lv.3 才能进），向右是洛兰。
- 格兰之森在赫顿玛尔左手边（“经过风振一直向左”）。
- 赫顿玛尔分市政街、中央广场、旧城区、后街四块。
- 西海岸分商贸区、魔法师公会两块。
- NPC 名单按官方百科的各区域 NPC 表。

自创部分：
- 旧城区通往西海岸、中央广场上下连着旧城区和后街，这两条连接是合理设计（官方资料没写清）。
- 雷蒙、莉莉两个 NPC 是原创。

## 2. 新增一个城镇 / 小区域

在 `src/content/world/towns.js`（区域地图写在 `grand_flores.js`，或者新建一个 `content/world/<地区>.js`，并加进 `src/ORDER`）里写：

```js
defineScene('hm_market', {
  name: '赫顿玛尔', area: '市场街',          // name = 城镇名（右上角大字、世界地图分组）；area = 小区域名
  kind: 'town',                              // 'town' 城镇 | 'field' 区域地图（有地下城门）
  width: 2800, theme: 'town', bgm: 'hendon', // theme 对应 art/final/bg/<theme>_{far,floor,edge}.webp
  ambient: 'petals',                         // 环境粒子：leaves 落叶 / petals 花瓣 / sunbeam 室内光柱 / dust 光尘 / lantern 灯火光点 / magic 魔法光点 / gulls 海鸥
  map: [52, 24],                             // 世界地图坐标：横 0~100，纵 0~62
  props: [ { art: 'world/b_merchant', x: 600, h: 230 }, { art: 'world/p_lamp', x: 900, h: 128, glow: [0.74, 0.36, 30] } ],
  npcs: [ { npc: 'norton', x: 650, y: 46 } ],
  exits: [ { side: 'right', to: 'hm_plaza' } ],
});
```

**出口（exits）**
- `side`：
  - `'left'` / `'right'`：走到场景左右边缘。
  - `'up'`：在 `x` 处往后墙走，用于门或路口。
  - `'down'`：在 `x` 处往下走出画面。
- 连接必须双向：对面场景也要有一个 `to` 指回来的出口。玩家进入场景时，会站在“指回来源场景”的那个出口旁边。
- `minLv: 3`：等级不够时拦住，并提示。
- `locked: '提示文字'`：还没开放的路，只提示、不切换场景（配合 `label` 写显示名）。
- `door: true`：建筑的门，名牌只在走近时显示。
- 同一侧的左右边缘只能各有一个出口。

**道具（props）**
- 不写 `y`：贴在后墙线上，画在角色后面。
- 写 `y`（0~196）：摆在地面上，和角色按纵深排序。
- `anim` 动画：
  - `'flag'`：旗子，左端固定。
  - `'hang'`：挂布，上端固定。
  - `'sway'`：摇摆。
  - `'bob'`：漂浮。
  - `'breathe'`：小动物呼吸。
  - `'fountain'`：喷泉水珠。
- `glow: [x, y, 半径, 'r,g,b']`：灯火光晕，x / y 是图内相对位置。
- `flip: true`：镜像。

**其他**
- 室内场景加 `interior: true`（没有路人），宽度可以就是一屏 960。
- 路人数量默认按场景宽度算：城镇 3~5 个，区域地图 2 个，室内 0 个。要改就写 `crowd: n`。

## 3. 新增 NPC

```js
defineNpc('norton', {
  name: '诺顿', title: '商人 · 分解',
  art: 'world/npc_norton', h: 120,           // 立绘与显示高度（成年人 114~124，小孩 90~100）
  services: ['quest', 'shop:norton', 'disassemble'],
  greet: ['欢迎光临！'],                      // 打开对话时的开场白（可省略，省略时从 lines 随机）
  lines: ['……', '……'],                       // 闲聊台词
});
```

然后把它放进某个场景的 `npcs`，一个 NPC 只能出现在一个场景。

**功能（services）**
- 已有的功能：
  - `quest`
  - `shop:<商店id>`（货架由装备组定义，没定义的会显示通用杂货）
  - `storage`、`repair`、`enhance`、`disassemble`
  - `job`（转职导师要写 `jobFor`）
  - `cure`
  - `travel`（区域移动，打开世界地图）
  - `arena`（决斗场，由战斗组注册）
- 新的功能类型：在 `NPC_SERVICES` 里注册（`ui/npc.js` 归任务组），或在自己的文件里写 `NPC_SERVICES.xxx ??= {...}`。

**其他字段**
- `still: true`：物件型 NPC（例如布告栏），不做呼吸和转身动画。
- `shadow`：影子半径。

**协作**
- 新 NPC 的 id、所在场景、功能，要先发到 `.team/board.md`。
- 任务组靠 id 挂任务，装备组靠 `shop:<id>` 配货架。

## 4. 新增地下城与门

地下城写在 `grand_flores.js` 或新的区域文件里：

```js
defineDungeon('moon_tavern', { name: '月光酒馆', lvl: [49, 52], theme: 'tavern', rooms: 6, mobs: [['zombie', 3]], boss: { kind: 'boneLord', lvl: 52 }, clearExp: 9000, desc: '……' });
```

然后做两件事：
1. 在某个 `kind: 'field'` 场景的 `gates` 里放门：`{ dungeon: 'moon_tavern', x: 900 }`。
2. 在 `GATE_ART` 登记门的美术：

```js
moon_tavern: { art: 'world/g_moon_tavern', portal: [0.5, 0.56, 0.16, 0.3], col: '255,210,120' }
```

`GATE_ART` 各字段：
- `portal`：传送门在图里的中心和半径（0~1），叠加的旋转光晕画在这里。
- `col`：光的颜色。
- `h`：显示高度，默认 200。
- 没登记时依次找 `world/g_<id>`、通用门 `world/b_gate`（隐藏地下城用 `b_gate_hidden`）。

**隐藏地下城**
- 写 `hidden: true, unlock: { quest: '任务id' }` 或 `unlock: { clear: '地下城id' }`。
- 条件满足后门才出现。
- 第一次出现时播放天降光柱的现身特效，记录在 `save.data.hiddenSeen`。

**门牌**
- 门牌显示名字和推荐等级，按玩家等级着色：
  - 红：等级不够。
  - 灰：已经太简单。
  - 紫：隐藏地下城。

**返回门口**
- 打完地下城回到这扇门口，因为进门时 `save.data.loc` 记在门口。

## 5. 美术：生成、处理、分包

### 画风
Q 版可爱卡通（2026-09-27 用户选定）。统一的提示词常量在 `art/tools/jobs.py`：
- `CHIBI`、`STYLE`
- `NPC_TAIL2`：NPC 立绘的结尾
- `BLD`：建筑
- `GATE`：地下城门

新素材沿用这些常量，才能和现有的保持一致。

### 生成（用全局技能 gpt-image）
1. 在 `jobs.py` 里加描述：`NPCS2`（NPC）、`BLD2`（建筑）、`GATES`（门）、`PROPS`（4×4 道具表）、`TOWN_BG`（场景背景的远景 / 地面 / 交界带）。
2. 运行：

   ```bash
   # AI 原图不进仓库；在 worktree 里跑一定要指向主仓库，否则原图会随 worktree 丢失
   export ART_SRC_ROOT=/Users/luzhipeng/projects/dawnbreak/art
   python3 art/tools/jobs.py town2 -j 3 --only npc_xxx   # 已存在的输出会跳过，可断点续跑
   python3 art/tools/jobs.py town2e -j 2                 # 交界带：以远景为参考图，要等远景出完再跑
   ```

3. 限额（全队共用一个账号）：
   - 同时最多 3 个请求。
   - 遇到 429 退避 60 秒以上（脚本已经自动处理）。
   - 上传参考图全队共 5 次/分钟，交界带用的就是上传。
4. 新类型的素材先出一张样例，自己看过再批量。
5. 每张都要亲自打开看，确认：风格一致、没有多余物体、白底干净。
   - 不合格的：原图改名成 `.bak` 留着，改提示词后重出。
   - 常见问题：建筑旁边多画了一栋房子、喷泉背后带了楼。可以在描述里写 “ONLY … with NOTHING behind it”。

### 处理成游戏素材

```bash
python3 art/tools/worldprep.py npc_xxx b_xxx g_xxx props_   # 去背、补洞、裁边、缩放 → art/final/world/*.webp
python3 art/tools/bgs.py 主题名                             # 远景 / 地面 / 交界带 → art/final/bg/<主题>_{far,floor,edge}.webp
```

尺寸规则：
- NPC：高 300。
- 建筑和门（`b_*`、`g_*`）：高 560。
- 道具表 `props_*`：按 `PROP_NAMES` 的顺序切成 16 个 `p_*`，最大高 280。相邻格子伸过来的碎块会自动去掉。
- 场景背景：`FLOOR_W`（地面纹理缩放）要登记新主题。室内的地板线更高，用 `FAR_CROP` 调远景截取范围，并在 `world.js` 顶部的 `BG_GRADE` 里写 `anchor`（远景地平线）和整体色调。

处理完再看一遍：把新图贴到深色底上检查白边、缺块。

### 分包（build.mjs 的 bundleOf）

| 路径 | 分包 | 何时加载 |
|---|---|---|
| `art/final/world/*`（建筑、门、NPC、道具） | `world` | 进场景时只等这个场景用到的那几张（`sceneArtKeys`，按键零散加载）；进场景 3 秒后，整个包（约 4 MB）在后台加载 |
| `art/final/bg/<主题>_*` | `bg:<主题>` | 进入用这个主题的场景 / 地下城时 |
| `art/final/scene/<id>/*` | `scene:<id>` | 预留给单个场景的专用大图 |
| `art/final/spr/<职业>/*` | `spr:<职业>` | 城镇路人只按需加载站立 / 走 / 跑三组帧（`loadArtKeys`） |

**控制 world 包的体积**
- 小道具尽量放进道具表，一次生成 16 个。
- 单个场景特有的大图放到 `scene/<场景id>/`，并在 `worldBundles` 里给该场景加载。
- 网页版分包要用 `WEB=1 node test/world.mjs` 验证。

## 6. 城镇音乐

曲目写在 `src/engine/music.js` 的 `SONGS`：

| 曲目 | 用途 | 风格 |
|---|---|---|
| `town` | 艾尔文防线 | 田园吉他 + 长笛 |
| `seria` | 赛丽亚的房间 | 八音盒 |
| `hendon` | 赫顿玛尔 | 进行曲 |
| `backstreet` | 后街 | 爵士 |
| `westcoast` | 西海岸 | 水手小调 |
| `guild` | 魔法师公会 | 竖琴与钟声 |
| `field` | 区域地图 | — |

写法：
- 旋律用调内音级写，8 小节 = 64 个八分音符记号，每个记号占 `unit` 个十六分音符。
- 场景的 `bgm` 填曲目名。
- `test/world.mjs` 会逐首检查有声音、不削波。

## 7. 测试清单

`node test/world.mjs`，截图在 `test/shots/world/`，要亲自看图。测试会检查：

- 内容校验没有问题。
- 新角色出生在 `START_SCENE`。
- 每个场景：素材齐全、画面不黑、路人数量正确。
- 每个出口都能走过去，并且落在回程出口旁，再走回来。
- 锁住的路和等级限制能拦住玩家。
- 所有 NPC 能对话。
- 世界地图：画出所有地点，标出当前位置，能区域移动（按 N 打开时在区域地图里不能传，诺羽 / 马琳可以传）。
- 隐藏门播放现身特效。
- 从地下城回来站在门口，并且不弹窗。
- 城镇曲目有声音。

## 8. 如何新增一个地下城区域（以天空之城为例）

这一节由地下城内容组编写，讲的是新增一整块地下城区域：区域地图、一组地下城、新怪物与领主、新背景。
天空之城是格兰之森之后的区域，Lv14~25。官方经典版是 Lv17~30，本作压缩了等级。
需要的代码都在三个新文件里，不用改别人的文件：

| 文件 | 内容 |
|---|---|
| `src/content/monsters/sky_castle.js` | 怪物、领主、招式、房间机关、`MON_ART` 精灵映射 |
| `src/content/themes/sky_castle.js` | 新主题 `THEMES.<主题>` 与色调 `BG_GRADE` |
| `src/content/world/sky_castle.js` | 地下城 `defineDungeon`、区域地图 `defineScene`、门的美术 `GATE_ART` |

`src/ORDER` 里这三个文件放在 `content/world/grand_flores.js` 之后、`content/sprites.js` 之前。
- 要在 bestiary / room / themes / world 之后：因为要扩展它们定义的 `MON`、`MON_ART`、`THEMES`、`BG_GRADE`、`GATE_ART`。
- 要在 sprites.js 之前：sprites.js 会按 `MON_ART` 给怪物换上逐帧精灵。

### 8.1 先定表，再动手（协作）
开工前在 `.team/board.md` 发一条“接口约定”，写清楚下面几项，其他组照着做：
- 地下城 id、名称、等级、领主。
- 怪物 id（任务组的击杀任务、装备组的掉落表都靠 id）。
- 隐藏图的解锁任务 id。

天空之城的分工：
- 世界组：在西海岸加通往 `sky_castle` 的云梯出口（`minLv: 14`），并画 6 张门图 `world/g_<id>`。
- 任务组：写天空之城篇任务，以及隐藏图的解锁任务 `q_hidden_floating`。
- 装备组：写 6 张图的掉落表，并把新图加进 `test/econ.mjs` 的经验 / 金币模拟。经验数值按模拟结果定：Lv14→24 约 9 次地下城。

### 8.2 地下城与区域地图

```js
defineDungeon('dragon_tower', { name: '龙人之塔', lvl: [14, 16], theme: 'skyTower', rooms: 6, branches: 2,
  mobs: [['wyvern', 3], ['dragonman', 3]], elite: 'minius', boss: { kind: 'lucas', lvl: 17 }, bossAdds: 2, clearExp: 4800, bgm: 'dungeon', desc: '……' });
defineScene('sky_castle', { name: '天空之城', area: '天空之城', kind: 'field', width: 3600, theme: 'skyTower', bgm: 'field', map: [30, 5],
  exits: [{ side: 'left', to: 'west_coast' }], gates: [{ dungeon: 'dragon_tower', x: 480 }, /* …… */] });
```

写法要点：
- **等级**
  - 相邻地下城的 `lvl` 要有重叠，`boss.lvl` 比 `lvl[1]` 高 1。
  - 普通难度的机器人要能在 `lvl[0]+1` 级稳定通关。
  - 区域地图上的门从入口往里等级递增。
- **每张图的特色**：每张图至少要有一种新怪或一种新机关，领主房用 `bossAdds` 带小怪。
- **隐藏图**：写 `hidden: true, unlock: { quest: 'q_hidden_floating' }`，门会在任务完成后出现。
- **门的美术**：写 `if (typeof GATE_ART !== 'undefined') Object.assign(GATE_ART, {...})`，用 typeof 保护，没加载世界组的文件时也不报错。

### 8.3 怪物
用 `Object.assign(MON, {...})` 加怪物。数值是 1 级的基数，实际值会随等级放大：
- 血量 ×(1 + (等级−1)×0.15)
- 攻击 ×(1 + (等级−1)×0.1)
- 经验 ×(1 + (等级−1)×0.4)

数值参照同等级的现有怪物：

| 类型 | hp | atk | def | exp | gold |
|---|---|---|---|---|---|
| Lv14~22 普通怪 | 5000~13000 | 215~268 | 220~480 | 100~130 | [22,45]~[30,60] |
| 领主 | 112000~175000 | 295~330 | 470~620 | 1600~3400 | [220,420]~[380,700] |

- 普通怪：远程 / 脆的血少，近战 / 重甲的血多。
- 领主要写 `bars`（血条数）和 `scale`。
- 节奏目标：机器人按推荐等级打，每个房间 15~30 秒，领主战 1~2 分钟。
  - 打得太久就降 hp，不要动 exp / gold，因为经验和金币由装备组的经济模拟来定。
  - 被击次数太多就降远程怪的出手频率。

招式 `attacks: [{ clip, range, dy, cd, w, cond, act }]`：
- 片段 `clip` 只能用 `SPR_ANIMS.monster` 里有的：`club atk1 axe slam scratch bite throw cast roar pounce chargeW charge heal`。
- 近战直接用 bestiary 的 `melee(clip, t0, t1, box, { range, cd, sa, hit, events })`。

**让玩家躲得开（用户嫌难，这是硬性要求）**
- 所有大招都要有预警，出手前要给够反应时间。
  - `telegraph({ x, y, r, dur, col, follow, kind, fire })`：地面预警圈。`kind: 'line'` 是冲刺 / 激光路线，`'hex'` 是陨石，`'frost'` 是白霜。
  - 霸体招式（`superArmor: true`）的头顶会自动弹出红色“!”。
  - 预警时间：普通怪 0.5~1.1 秒，领主 0.9~1.6 秒。
- 预警跟随玩家时只跟前 35% 的时间，之后锁定，跑出圈就能躲开。
- 每个大招都要留一条生路：
  - 天之驱逐者的落雷最多落 3 条（共 4 条纵深）。
  - 罪恶之眼的眼球列总缺一个。
  - 光之城主的雷电密布只落在一个圆环里，贴身或离远都安全。
- 霸体领主要给反击窗口：普拉塔尼几乎一直霸体，但连续冲撞之后会“过热”2.4 秒（受到伤害 ×1.35，并且可以打出硬直）。

可以复用的招式模板（`content/monsters/sky_castle.js`）：

| 函数 | 作用 |
|---|---|
| `skySpikeAt` | 红圈地刺 |
| `skyDischarge` | 放电圈 |
| `skyCage` | 囚笼 |
| `skyStrings` | 提线拉扯 |
| `skyStoneShot` | 石化石弹 |
| `skyDart` | 毒飞镖 |
| `skySmokeBomb` | 致盲烟雾 |
| `skyDashAct` | 短冲刺 |
| `skyDashChain` | 连续冲撞 + 过热 |
| `skyNova` | 自身周围的冲击波 |
| `skyLaser` | 先细线后光束的激光 |
| `skyThunderLanes` | 落雷列 |
| `skyLightField` | 环形雷电 |
| `skyTrackBeams` | 追踪光柱 |
| `skyEyeRow` | 石化眼球列 |

**召唤**
- 在 `MON.<领主>.summons` 里列出被召唤的怪，`monBundles` 会提前加载它们的精灵。
- 召唤时用 `spawnMonster(kind, x, y, { lvl, drop: true, ...skyMul() })`，这样难度倍率也会跟着生效。

**房间机关**
房间机关不改 dungeon.js，而是监听事件：
- `bus.on('roomEnter', d => ...)`：`d.id` 是地下城、`d.type` 是房间类型（boss / elite / normal / start）。例如：
  - 龙人之塔的领主房两侧放龙之雕像（自定义 `m.control`）。
  - 悬空城的侍剑骑兵开局是石像（`skyMakeStatue`）。
- `bus.on('kill', d => ...)`：例如打倒石巨人操纵师后，房间里的石巨人一起崩裂。

### 8.4 美术：逐帧精灵
流水线：参考立绘 → 3×3 动作表（walk / run / act / more 共 4 张）→ 切帧。
所有命令都在 `art/tools/sky_art.py` 里，复用 jobs.py 的画风常量、sheets2.py 的提示词、frames2.py 的切帧规则，不改这些文件。

```bash
python3 art/tools/sky_art.py refs   --only lucas   # 1 张参考立绘，写到主仓库 art/src/sky/lucas_ref.png
python3 art/tools/sky_art.py sheets --only lucas   # 4 张动作表，写到 art/src/sky/sheets2/
python3 art/tools/sky_art.py cut    --only lucas   # 切帧，写到 art/final/spr/lucas/*.webp + spr.json；预览在 art/src/sky/cut/
```

- **新怪物**：在脚本的 `M` 表里加一项，写上外观、站立高度 `h`（世界单位，玩家约 115）、手持物 `hold`、攻击 / 施法 / 低姿态的描述。
- **悬浮怪物**：写 `fly=True`，走 / 跑改用漂浮循环；再在 `HOVER` 里写悬浮高度，切帧时整体抬高，影子留在地上。
- **切帧**：会去掉被身体包住的白底（武器和身体之间的缝）。白色系角色（全身白甲、白发）请写 `holes=False`，否则会把角色本身挖空。
- **变种**：用 `MON_ART` 染色（`hue` 色相、`sat` 饱和度、`bright` 亮度），例如 `minius: ['dragonman', { hue: 95, sat: 1.1 }]`。
- **规则**
  - 新类型先做一个样例，自己逐帧看预览图，确认比例、朝向、手脚交替和白底都没问题，再批量。
  - 生图全队共用一个账号：本组同时最多 2 个请求，脚本里的 `PAR = 2` 已经写好。

### 8.5 美术：背景
每个主题三层：远景 far、地面 floor、交界带 edge。

```bash
python3 art/tools/sky_art.py bg    --only skyHall   # 远景 + 地面
python3 art/tools/sky_art.py edge  --only skyHall   # 交界带（以远景为参考图，要等远景出完）
python3 art/tools/sky_art.py bgcut --only skyHall   # 裁切 → art/final/bg/skyHall_{far,floor,edge}.webp
```

主题代码写在 `content/themes/*.js`：
- `THEMES.<主题>.far/mid/wall/floor/fore`：没有手绘背景时的程序化兜底。
- `back(c, room)`：画在背景之上、角色之下。例如飘过的云、墙上的火把。
- `ambient(c, room)`：画在最上层。例如花瓣、光点，黑暗玄廊的“只有玩家周围亮”也画在这里。
- `BG_GRADE` 里写整体色调。

### 8.6 测试

```bash
node build.mjs
node test/sky.mjs                                    # 数据完整性 + 每种怪物生成 / 出手 / 击杀 + 每个领主的每一招强制放一遍
node test/sky_route.mjs                              # 西海岸云梯（Lv.14 限制）→ 区域地图 → 每个门 → 进地下城 → 回到门口
SPEED=3 node test/botrun.mjs dragon_tower:15:0:sword,puppet_hall:16:0:gun,golem_tower:17:0:mage   # 机器人按推荐等级通关（地下城:等级:难度:职业）
node test/flow.mjs                                   # 必须继续通过
```

- 截图在 `test/shots/sky/` 和 `test/shots/bot/`，要亲自看：
  - 怪物比例对不对、脚是不是踩在地上。
  - 预警圈清不清楚。
  - 背景有没有接缝。
- `test/sky.mjs` 的检查项：
  - 每个地下城的怪物、主题、色调、精灵分包、背景素材都存在。
  - 区域地图的门都指向存在的地下城。
  - 每种怪物都有逐帧精灵，会主动出手，能被打死。
  - 每个领主的每一招都触发过，并且至少出过一次地面预警。
  - 页面没有报错。

### 8.7 第二个区域：天帷巨兽（照着天空之城再做一遍）
天帷巨兽（Lv24~30）完全按上面的步骤做，文件是：
- `content/{monsters,themes,world,quests}/behemoth.js`
- `art/tools/behemoth_art.py`
- `test/behemoth.mjs`、`test/behemoth_route.mjs`

这次多出来的做法，下一个区域可以直接用：
- **复用招式模板**：behemoth 的文件排在 sky_castle 之后，天空之城的 `sky*` 模板直接拿来用，不用复制。新写的模板用 `bh*` 前缀：

  | 函数 | 作用 |
  |---|---|
  | `bhLob` | 抛物线投弹 + 落点红圈 |
  | `bhKnives` | 扇形飞刀 |
  | `bhDash` | 可调预警时长的冲刺 |
  | `bhRootWave` | 沿纵深推进的地刺 |
  | `bhRoarWave` | 贴地扩散的冲击波，跳起来可以躲 |
  | `bhCarpetBomb` / `bhMissiles` | 轰炸 / 追踪导弹 |
  | `bhTentacleSweep` / `bhTentacleSlam` | 触手横扫 / 触手连砸 |
  | `bhInk` | 墨汁致盲 |
  | `bhBarrier` | 减伤护罩，把领主引出来 |
  | `bhSummon` | 召唤 |
  | `bhRegen` | 一段时间没挨打就回血 |

- **一个区域多张区域地图**：`behemoth`（神殿之路）→ 右出口 `minLv: 27` → `behemoth_spine`（脊背）。两张图都要写 `map` 坐标，并且双向连接。
- **从别人的场景接进来**：只改入口那一个出口，写 `{ side: 'up', x, to: '新区域', minLv, label, optional: true }`，并告诉场景主人（这次是西海岸的船，世界组的 towns.js）。
- **双领主 / 保护机制**：
  - 领主房的第二个怪，用 `bus.on('roomEnter')` 在 `d.type === 'boss'` 时刷出来。
  - 保护用 `dmgTakenMul` 实现，并且要画出来、弹文字提示。例：大祭司活着时，大主教受到的伤害 ×0.5。
  - 深渊（装备深化组）会单独刷领主，所以这类机关必须只挂在这个地下城的房间事件上，不要写进领主本身。
- **保证精英出现**：精英房是随机的。任务要求打的精英，用 `roomEnter` 放进“通往领主房的前一个房间”。例：第二脊椎的巨型黑章鱼。
- **没有腿的怪物**：
  - 车辆 / 植物 / 飞行器：在 M 表里写 `cycle`（自定义走 / 跑循环）。
  - 不需要的动作表用 `sheets` 去掉。
  - 飞行器写 `fly` + `HOVER`。
- **任务**：
  - 写在 `content/quests/<区域>.js`，`pre` 接上一个区域的最后一个主线（天帷接的是 `q_c18`）。
  - 任务道具用 `icon` 共用现有图标，不另外出图。
  - 隐藏图的解锁任务 id 要和 `unlock: { quest }` 一致。
- **测试**：`test/region_monsters.mjs` 是两个区域共用的怪物测试，新区域只要写一个小配置文件（参照 test/behemoth.mjs）。
- **生图配额**：多组同时生图时，本组同时最多 1 个请求。在脚本里设 `A.PAR = 1`、`A.BACKOFF = 95`。
