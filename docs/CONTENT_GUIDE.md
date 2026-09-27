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
| `art/final/world/*`（建筑、门、NPC、道具） | `world` | 进入任何城镇 / 区域场景时 |
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
