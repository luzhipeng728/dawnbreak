# 破晓地下城 · 架构与分工

## 构建
- `src/ORDER` 列出的 JS 按顺序拼接进同一个 `<script>`，共享一个全局作用域（没有 import/export）。后加载的文件可以覆盖 / 扩展前面的定义（例如 `Object.assign(menus, { w_xxx })`）。
- `node build.mjs` 输出：
  - `dist/web/`：网页版，美术按分包懒加载，用 `loadBundles` / `withLoading`。
  - `dist/dawnbreak.html`：离线单文件（测试默认用它）。`node build.mjs --web` 只出网页版（部署 `tools/deploy.sh web` 用这个），`--offline` 只出单文件。
- 美术放在 `art/final/<分类>/<名字>.webp`，代码里通过 `IMG['<分类>/<名字>']` 取用。分包规则见 `build.mjs` 的 `bundleOf`：
  - `spr:<id>`：逐帧精灵
  - `bg:<theme>`：场景背景
  - `world`：城镇建筑、门、NPC 立绘
  - `scene:<id>`
  - `core`：图标、特效等，启动时加载
- 测试：`test/*.mjs`，无头 Chrome。
  - 必跑：`node test/flow.mjs`。
  - 调试参数：
    - `?town&cls=gun`：直接进城
    - `?dungeon=lorien&lv=10`
    - `?test&cls=mage&mon=goblin`
    - `?art&m=sword&anim=walk`
    - `?fresh`：空存档

## 模块归属

每块只由一个人改；需要改别人的文件时，发消息给文件主人，或写到协作板。

| 负责人 | 拥有的文件 | 内容 |
|---|---|---|
| 战斗与动作 | `engine/entity.js` `engine/proj.js` `engine/fx.js` `game/player.js` `models/poses.js` `models/imgmodel.js`（SpriteModel） `content/classes/*` `content/sprites.js` `art/final/{spr,fx,cutin}` | 战斗机制、技能、转职技能、动作帧、决斗场 |
| 任务与转职 | 新建 `game/quests.js` `content/quests/*` `ui/quest.js` `ui/job.js`；接管 `ui/npc.js` | 任务系统、NPC 对话窗口、转职流程与窗口 |
| 装备与经济 | `game/items.js` `game/progress.js` `game/drops.js` 新建 `content/items/*` `ui/items/*`（背包 / 角色信息 / 商店 / 强化 / 分解 / 仓库窗口） `art/final/icon/item*` | 物品库、四维与属性计算、掉落、商店、强化 |
| 界面与操作 | `ui/menus.js`（窗口框架与通用窗口） `ui/hud.js` `engine/touch.js` `engine/core.js`（KEYMAP 与 input） `shell_top.html` `shell_bottom.html` | 角色选择 / 创建、快捷键与按键设置、技能窗口 K、系统窗口、HUD、手机适配、窗口拖动 |
| 世界与美术 | `game/world.js` `content/world/*` `engine/music.js` 新建 `ui/worldmap.js` `art/final/{world,bg,scene}` `art/tools/{bgs,worldprep}.py` | 城镇 / 区域场景、NPC 摆放与立绘、世界地图 N、城镇氛围 |
| 主线程（总协调） | `game/save.js` `game/dungeon.js` `game/flow.js` `game/game.js` `build.mjs` `src/ORDER` `docs/*` `test/flow.mjs` | 集成、合并、存档、地下城流程、发布 |
| 联机 | `server/`（核心：lib / core / deploy） `src/net/*` `src/ui/{login,chat,friends,party}.js` `test/net_*.mjs` `test/mp_*.mjs` | 账号、云存档、同屏、聊天、好友、组队刷图、好友决斗（设计见 docs/NETWORK.md） |

`src/ORDER`：新文件请加到合适的位置。合并时我会统一处理冲突。

## 共享接口

### 事件总线（`engine/events.js`）
- 写法：`bus.on(事件, fn)` / `bus.emit(事件, 数据)`。完整事件表见文件头。
- 常用事件：`kill`、`dungeonClear`、`dungeonEnter`、`roomEnter`、`levelUp`、`pickup`、`gold`、`sceneEnter`、`npcTalk`、`itemUse`、`equip`、`jobChange`、`skillUse`。
- 任务、成就、教程一律靠监听事件实现，不要往战斗 / 地下城代码里塞调用。

### 窗口（`ui/menus.js`）
- 用 `menus.open(名字, 参数)` 打开窗口，它会调用 `menus['w_' + 名字](参数)` 生成 DOM。
- 通用外框：`menus.win(标题, 内容, { w })`。
- 新窗口写在自己的文件里，用 `Object.assign(menus, { w_xxx(arg) {...} })` 注册。
- 样式用 `addStyle(css)` 写在自己的文件里，不要改 `shell_top.html`（那是界面负责人的）。
- 窗口名分配（不要占用别人的名字）：
  - 界面：`title` `charselect` `newgame` `skills` `settings` `system` `help` `keyconfig`
  - 装备：`inv` `status` `shop` `storage` `enhance` `disassemble` `sell`
  - 任务：`npc` `npcquest` `quests` `job`
  - 世界：`worldmap`
  - 主线程：`dungeon` `result`
  - 联机：`login` `account` `passwd` `friends` `party` `pmenu` `pinfo`，联机提示框 `nd_*`（聊天框是 DOM `#chatbox`）

### 拖放（`ui/dnd.js`）
- `dnd.source(el, () => payload)`：让元素可以被拖起。
- `dnd.target(el, { accept, drop })`：让元素接收拖放。
- `dnd.canvas(fn)`：HUD 画布上的落点。
- payload 约定：
  - `{ type: 'item', item, from: 'inv'|'equip'|'storage'|'shop'|'quick', slot? }`
  - `{ type: 'skill', id, from: 'skills'|'bar', slot? }`

### 快捷键
- 由界面负责人统一在 KEYMAP 里分配（官方键位），玩家可在 O → 按键设置里改键。
- 显示按键名用 `keyName(动作)`，不要写死字母。

| 类别 | 按键 | 作用 |
|---|---|---|
| 战斗 | X | 攻击 |
| | C | 跳跃 |
| | ↓ + C | 后跳（技能中 / 受击中要学 10 级通用技能「后跳-强化」）；倒地后 C = 受身蹲伏 |
| | Z | 指令键（Z 类技能） |
| | Space | 指令键 2（Space 类技能，`cmdB`，和 Z 分开） |
| 技能栏 | ASDFGH + Alt / QWERTY + V | 技能栏两排，每排 7 格（`s0..s5` + `s12`，`s6..s11` + `s13`；`SKILL_SLOTS = 14`） |
| | 1~6 | 消耗品 |
| 窗口 | I | 物品 `inv` |
| | M | 个人信息 `status` |
| | K | 技能 `skills` |
| | L / F1 | 任务 `quests` |
| | N | 地图 `worldmap` |
| | O | 设置 `settings` |
| | P | 决斗场 `duel` |
| | Esc | 关闭最上层窗口，没有窗口时打开系统菜单 |
| 杂项 | Tab | 切换界面模式 |
| | Ctrl | 显示掉落物名称 |
| | End | 隐藏实时评价 |
| | ` | 说明详略 |
| | F12 | 截图 |

- 界面偏好用 `uiPref(名字)` 读取，例如 `shake`、`hideRank`、`dropNames`。
- 窗口还没实现时，按快捷键会提示“暂未开放”。

### 属性（`recalcStats(p)` 写到玩家实体上，战斗结算读取）
- 字段：`atk` `matk` `indep` `def` `mdef` `crit` `mcrit` `critDmg` `aspd` `cspd` `mspd` `hitRate` `evade` `elem{fire,ice,light,dark}` `res{...}` `hardness` `stagger` `hpMax` `mpMax`。
- 四维：`str` 力量、`int` 智力、`vit` 体力、`spr` 精神。

### 物品
- `makeItem(key, n)`：按物品库 key 生成物品，装备 / 消耗品 / 材料通用。
- `inv.add(it)`、`inv.count(key)`、`inv.take(key, n)`。
- `itemTip(it)`：返回 tooltip DOM。
- `itemIconSrc(it)`：返回图标 URL。
- 旧函数 `makeConsumable` / `makeEquip` 保持可用。

### 转职
- 数据：`CLASSES[cls].jobs = { jobId: { name, desc, skills, awaken, awakenName } }`；技能上标 `job: jobId`。
- 当前职业存在 `game.job`，存档由主线程负责。
- 转职等级 15，觉醒技能 lvReq 18。
- 转职完成：`bus.emit('jobChange', { job })`；如果定义了 `onJobChange` 就调用它。

### 存档
- `save.data` 是当前角色。需要新字段时在自己的模块里懒初始化：`save.data.xxx ??= 默认值`，不要改 `save.js`。
- 结构升级需要迁移时，告诉主线程。
- 多角色：`save.chars`、`save.select(i)`、`save.newGame(cls, name)`、`save.remove(i)`、`MAX_CHARS`。

### 世界
- 注册函数：`defineScene` / `defineNpc` / `defineDungeon`（`game/world.js`）。
- `game.scene === 'town'` 表示在城镇或区域场景里，当前场景是 `world.S`。
- NPC 功能按钮在 `NPC_SERVICES` 里注册（`ui/npc.js`）。

### 外观（换武器 / 时装，models/avatar.js）
- 职业精灵 `art/final/spr/{sword,gun,mage}/` 的每一帧都**不含武器**。生成时手里拿纯绿占位棍，切帧时抠掉，同时把武器轨迹写进 `spr.json`（`wpn` / `wpn2` / 头部锚点）。运行时再按轨迹画武器图（`art/final/weapon/`）。
- **新增角色动作帧必须走外观流水线**：`art/tools/avatar_gen.py wpn` → `avatar_frames.py`。不要用 `frames2.py` 直接覆盖这三个目录，否则会画出两把武器。
- 时装是整套帧集：`art/final/spr/<职业>@<套装>/`，分包 `spr:<职业>@<套装>`。帽子 / 发饰 / 眼镜按头部锚点叠加。
- 绘制规范（性能）：每帧的绘制里不要用 `imageSmoothingQuality = 'high'`、`filter`、`shadowBlur`，混合模式只用 `source-over` / `lighter`。实测前两项会让 GPU 满载，帧率从 60 掉到 20~40。
  - 每帧也不要让很多实体各自在几张离屏画布之间来回拷贝（每次拷贝都要先冲刷源画布；受击闪白原来这么做，一屋子怪同时挨打时占世界层一半），不要每帧对大量文字 `strokeText` / 建渐变 / `toLocaleString`——着色剪影、文字都缓存成图再 `drawImage`。量法见 docs/PERF.md。
