# 破晓地下城 · 架构与分工

## 构建
- `src/ORDER` 列出的 JS 按顺序拼接进同一个 `<script>`，共享一个全局作用域（没有 import/export）。后加载的文件可以覆盖 / 扩展前面的定义（例如 `Object.assign(menus, { w_xxx })`）。
- `node build.mjs` 输出：
  - `dist/web/`：网页版，美术按分包懒加载，用 `loadBundles` / `withLoading`。
  - `dist/dawnbreak.html`：离线单文件。
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

### 拖放（`ui/dnd.js`）
- `dnd.source(el, () => payload)`：让元素可以被拖起。
- `dnd.target(el, { accept, drop })`：让元素接收拖放。
- `dnd.canvas(fn)`：HUD 画布上的落点。
- payload 约定：
  - `{ type: 'item', item, from: 'inv'|'equip'|'storage'|'shop'|'quick', slot? }`
  - `{ type: 'skill', id, from: 'skills'|'bar', slot? }`

### 快捷键
- 由界面负责人统一在 KEYMAP 里分配。其他人只需实现对应的窗口：

  | 键 | 窗口 |
  |---|---|
  | I | `inv` |
  | M | `status` |
  | K | `skills` |
  | O | `settings` |
  | N | `worldmap` |
  | F1 / L | `quests` |
  | Esc | `system` |

- 窗口还没实现时，用 `menus['w_x']` 判断存在后再打开。

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
