# 区域流水线（REGION_PIPELINE）

新区域 = 写一个纯数据的 spec 文件 → 跑一条美术命令 → 跑一个测试 → 看两张审图、修个别问题。
不用再读老区域的代码，也不用手写怪物 AI。第一个用它做的区域是「魔界 · 潜行者希洛克」（`src/content/regions/siroco.js`）。

| 文件 | 作用 |
|---|---|
| `src/game/mon_skills.js` | 怪物技能库 `MON_SKILLS`、领主机制库 `BOSS_MECHS`、行为原型 `MS_ARCH`、AI 外壳 `regionAI`、调试钩子 `monForceSkill` |
| `src/game/region.js` | 生成器 `defineRegion(spec)`：数值公式、房间模板、主题、怪物 / 领主、史诗、地下城、场景、入口、主线任务 |
| `src/content/regions/<id>.js` | 区域 spec（纯数据，只调用一次 `defineRegion`） |
| `src/content/regions/<id>_bosses.js` | 可选：领主的自定义钩子 `REGION_HOOKS.<名字>` |
| `art/tools/region_art.py` | 美术流水线（读同一份 spec） |
| `art/tools/region_spec.mjs` | 把 spec 导出成 JSON（`art/regions/<id>.json`） |
| `test/region.mjs` | 通用测试 |

引擎只加了一行钩子：`game/monsters.js` 的 `spawnMonster` 里 `if (D.onSpawn) D.onSpawn(m, o)`。老区域的怪物不受影响。

## 1. 做一个新区域（步骤）

1. 复制 `src/content/regions/siroco.js` 改成 `<id>.js`，按第 2 节改数据。在 `src/ORDER` 的 `content/regions/siroco.js` 后面加一行。
2. 先不管美术：`node build.mjs && node test/region.mjs <id> skills,mechs,quest`。没有精灵的怪物用 `look` 的程序外观，能先跑通逻辑。
3. 出图（主仓库 `art/src/regions/<id>/` 放原图，不进 git）：
   ```bash
   python3 art/tools/region_art.py <id> refs,bg,review1 --sample   # 参考立绘 + 一张背景样例 → review_refs.png，发给主线程看
   python3 art/tools/region_art.py <id>                            # 其余全部：动作表 → 切帧 → 比例校正 → 描边 → 背景 → NPC / 门 → 图标 → 总审图
   ```
   每个阶段都跳过已有的输出，断了直接重跑。只重做一个角色：删掉它的原图，`--only 名字` 重跑对应阶段。
4. `node build.mjs && node test/region.mjs <id>`（全部七部分），看 `test/shots/region_<id>/`。
5. 数值：看机器人那张表（用时 / 被击 / 死亡），只调 spec 顶上的 `power` / `bossPower` / `atkPower`。
6. 把 `review_final.png` 发给主线程；提交。

## 2. spec 字段

```js
defineRegion({
  id, name, lvl: 30, lvlMax?,            // 区域等级（地下城默认 [lvl, lvl+1]，领主 lvl+2）；跨好几级的区域写 lvlMax（地下城等级都在 lvl~lvlMax 之间）
  power: 6.5, bossPower: 0.75, atkPower: 3.2,   // 难度旋钮：普通怪血量、领主血量（再乘 power）、攻击
  entry: { scene, side, x, to, minLv, label },  // 从已有场景接进来的出口（自动加到那个场景上，不改别人的文件）
  themes: { <主题>: { pal, grade, ambient, rgb, floorW, bg: [远景, 地面, 交界带] } },
  monsters: { <id>: 怪物 }, bosses: { <id>: 领主 },
  items: { epics: [...], sets: [...], quest: [...] },
  dungeons: { <id>: 地下城 }, npcs: {...}, scenes: {...}, story: {...},
  art: { chars: {...}, gates: {...} },   // 只给美术流水线用
});
```

**数值公式**（`regionStats`，数值是 1 级基数，`spawnMonster` 再按等级放大）：普通怪 hp = (260×lv+1800)×类型系数×power，atk = (150+4.2×lv)×系数×atkPower，def = 16×lv+60；领主 hp = 5600×lv×power×bossPower（攻坚 `tier: 'raid'` 再 ×1.4），血条数 = lv。
类型 `tier`：`swarm` 0.5 血 | `caster` 0.74 | `normal` 1 | `flier` 0.8 | `brute` 1.35 | `elite` 1.6 | `boss` | `raid`。

**怪物**：
```js
jailer: { name, tier: 'brute', arch: 'guard', size: [宽, 纵深, 高], weight, scale, hardness, speed, pref, elem: 'fire',
  art: 'jailer' | ['jailer', { hue, sat, bright }],   // 精灵（art.chars 里的名字）+ 染色；变种不用另外出图
  look: ['zombie' | 'cat' | 'tau' | 'goblin', 配色],  // 没有精灵时的程序外观
  traits: { ... }, skills: [ { use: '技能', ...参数 } ] }
```
行为原型 `arch`：`aggressive` 冲上来打 | `kiter` 保持距离、贴身就后撤 | `guard` 守在出生点附近（+60 硬直抗性）| `flier` 悬浮 | `swarm` 又快又多。
特性 `traits`：`sa: 'cast'`（放技能时霸体）/ `'always'`（一直霸体）、`immune: ['freeze', 'stun']`、`onDeath: 'explode'`（+ `explode: { r, windup, dmg }`）、`regen: { rate, delay }`（delay 秒没挨打按 rate×HP/秒回血）、`reflect: 0.1`（反弹近战伤害）。`elem` 同时是攻击属性和 40 点抗性。

**领主**：
```js
siroco: { ...怪物字段, tier: 'raid', hook: 'siroco',
  mechs: [ { use: 'groggy', ... }, { use: 'enrage', t: 300 } ],            // 出场就有的机制
  phases: [ { at: 1, skills: [...] },                                         // 阶段：血量 ≤ at 时进入
            { at: 0.72, enter: { say, col, roar, heal, summon: { kind, n }, mechs: [...] }, skills: [...] } ] }
```
阶段技能从该阶段起一直可用（`only: true` = 只在这个阶段）；单个技能也可以写 `phase: [1, 2]`。进阶段默认有无敌咆哮（把玩家震开，`roar: false` 关掉）。

**地下城**：`{ name, lvl, bossLvl, theme, layout, mobs: [[id, 权重]], elite, boss, bossAdds, bgm, bossBgm, gate: { x, col }, desc, drops: { boss, mats }, preBoss: { kind, say } }`。
`layout` 房间模板：`short` 5 房 | `standard` 6 房 2 支路 | `long` 7 房 3 支路 | `raid` 一条直线 4 房（入口 → 两个前哨 → 领主）。`preBoss` 在通往领主房的前一个房间保证刷一只精英。

**场景 / NPC**：和 `defineScene` / `defineNpc` 一样；区域地图（`kind: 'field'`）的门按 `dungeons[*].gate.x` 自动摆。NPC 立绘固定是 `world/npc_<id>`，`look` 是给美术的描述。

**主线** `story: { chapter, prefix, pre, npc, scene, steps }`，每一步 `t`：`arrive`（`scene`）| `talk`（`with`, `lines`）| `clear`（`dungeon`, `diff`）| `boss` / `raid`（`dungeon`，可带 `collect: { key, item, icon, desc }`）| `handin`。都可以写 `name desc talk lvl npc to reward: { exp, gold, items, coins }`。任务 id 自动是 `<prefix>01…`，前后串成一条链。

**史诗**：`epics: [{ key, slot, lvl, name, fx, st, proc, desc, look }]`；`sets: [{ id, name, lvl, bonus, pieces: [{ key, slot, name, look }] }]`；`quest: [{ key, look }]`（任务道具图标 `icon/<key>`）。
史诗 / 套装写 `abyss: true` = 本区域的**深渊专属**（只在本区域的深渊派对掉落、宇宙灵魂兑换；图标照样由 `region_art.py <id> icons` 出，只出还没有的）。

### 2.1 深渊派对（`abyss` 块，由 `content/abyss.js` 展开）
每个区域都应该有自己的深渊。写法（希洛克的见 `siroco.js`；老区域格兰之森 / 天空之城 / 天帷巨兽写在 `content/abyss.js` 的 `ABYSS_LEGACY`，格式相同）：
```js
abyss: {
  abyss_<id>: { name, lvl: [30, 31], lordLvl: 33, lords: [领主 / 已有怪物],       // 深渊领主每次随机
    from: 已有地下城（复制怪物表 / 精英 / 背景）| mobs + elite + themeFrom（借背景）, theme, tint, layout | rooms,
    gate: { scene, x },            // 隐藏门（资格任务完成后现身）
    cost: 1, pity: 6, seal: 1,     // 每次消耗的邀请函；保底（连续 pity-1 次没出史诗，第 pity 次领主必掉，优先图鉴里没有的本区域专属）；深渊柱血量倍率
    waves: [{ n, mobs?, elite?（精英数）| elites?: [kind], say? }, ...],   // 第 1 轮用第一项，第 2 轮用最后一项的精英；只在派对出场的怪自动以权重 0 进怪物表（加载精灵）
    lord: { hp: 1.35, atk: 1.1, mechs: [机制...],                        // 降临时启动（领主机制库；领主自带的同种机制不重复加）
      cycle: [{ every: [20, 26], at: 0.6, say, mech: { use: 'safezone', ... } }] },   // 按间隔反复启动（at = 血量低于多少才开始）；老领主（手写 AI）也能用
    quest: { name, lvl, clear, pre, npc?, gold, desc, offer, done },   // 资格任务（默认歌兰蒂斯，id 默认 q_<地下城 id>，奖励邀请函 ×3）
    clearExp, desc } }
```
- 流程（通用，官方深渊派对）：扣 cost 张邀请函 → 深渊柱在随机一个普通房间（小地图紫色菱形）→ 打破后两轮：第 1 轮 = `waves[0]`，第 2 轮 = `waves` 最后一项的精英 + 深渊领主 → 两轮打完门才开，原地翻「深渊宝藏」（三张紫卡免费翻一张：宇宙灵魂 / 矛盾的结晶体 / 邀请函 / 异界精髓 / 金币 / 小几率史诗）→ 照常打到领主房（普通领主）。`waves` 写几项都行，只用第一项和最后一项。
- 史诗几率：深渊领主 28%（每档难度 +5%）、派对精英 3%；每次掉史诗一半出本区域的深渊专属，一半按领主等级随机（含其他深渊专属）。保底计数存 `save.data.abyss.pity[地下城 id]`，歌兰蒂斯的深渊窗口和结算界面都显示。
- 测试：`node test/region.mjs <id> abyss`（所有深渊的数据 + 本区域深渊的进图扣票 / 几波派对 / 领主机制 / 循环机制 / 保底 / 翻牌）；机器人：`BOT=abyss_<id>:sword node test/region.mjs <id> bot`。

### 2.2 机制地下城（远古：比尔马克帝国试验场 / 悲鸣洞穴）
模板生成的地下城只会“清怪 → 下一间”。需要逐个房间设计机关的（官方的远古图），spec 只当外壳用，机制写在手写模块里：
- spec（`src/content/regions/ancient.js`）：怪物 / 领主数值与招式、掉落、门、任务；`layout: 'ancient'` = 一条直线 6 房；门可以放在已有场景上（`gate: { scene }`，由钩子模块加进去）；
  只在机关里出场的怪以权重 0 写进 `mobs`（精灵随地下城加载）。
- 钩子模块（`ancient_rooms.js`，放在 spec 后面）：`ANC.rooms[地下城 id][房间序号] = { name, say, start(dg, R), update(dg, R, dt), draw(c, dg, R) }`——第一次进房间时清掉模板刷的怪、按房间自己的配置刷怪 / 放机关，之后每帧跑；
  领主的专属机制照样用 `REGION_HOOKS`。机关物件（召唤柱、路障、法阵核心）是 `msObj` 怪物：它们活着房间就不算清完（门不开）。
- 约定：`e.botSkip = true` 的目标机器人不打（机关物件、暂时打不动的领主），这样机器人能“按机制”打；`D.customModel` = 手画模型（没有逐帧精灵也算合格）；`ANC.stats` 记录每种机制触发了几次。
- 测试：`node test/ancient.mjs [bilmark,wailing]` 每个机关都要触发、也要能解开（例如伊凡超时自爆 / 清完才开路障、保护模式超时变牛头统帅 / 清完才解除、幼虫吞噬变成虫、爬到洞口给虫王回血）。

## 3. 怪物技能库（`skills: [{ use, ... }]`）

所有技能都能写的公共参数：

| 参数 | 含义 |
|---|---|
| `clip` | 播放的动作片段：`club atk1 axe slam scratch bite throw cast roar pounce chargeW charge heal` |
| `range` `dy` | 出手距离 [最近, 最远] 与纵深容差 |
| `cd` `w` | 冷却 [最短, 最长] 秒、权重 |
| `dmg` `stun` `knock` `down` `launch` | 伤害倍率、硬直、击退、倒地、浮空 |
| `elem` `status` `sdur` | 属性（默认用怪物的 `elem`）、异常状态（bestiary 的 burn poison bleed freeze stun slow blind…）与时长 |
| `sa` | 放技能时霸体 |
| `say` `col` | 头顶提示文字、预警 / 特效颜色 |
| `fx` `fxCol` | 运行时特效：`slash shock burst dust charge aura afterimage pillar`（帧里不画特效） |
| `then` | 放完接一招（另一个技能 spec） |
| 条件 | `hp: [低, 高]` 血量区间、`phase`、`adds: n`（场上小怪少于 n）、`crowd: n`（附近至少 n 个目标）、`ranged`（全场远程节流，普通怪默认开） |

| 技能 | 作用 | 参数（默认值） |
|---|---|---|
| `swipe` | 近战挥砍 / n 段连击 | `n 1, reach 72, width 22, windup 0.42, gap 0.34` |
| `dash` | 冲刺，先出红线预警 | `len 320, speed 640, windup 0.8, hw 22` |
| `shot` | 投射物 | `mode straight / spread / homing / arc, n 1, speed 300, spread 60, turn 2.4（追踪转向）, r 46（arc 落点圈）, pierce, size` |
| `aoe` | 地面范围 | `shape circle / ring（r0 内圈安全）/ line / cross, at target / self / front, r 70, len, hw 26, windup 1.0, n 1, scatter 120, follow, jump（跳起来能躲）` |
| `rain` | 落雨 / 陨石 | `n 5, interval 0.32, r 44, spread 170, windup 1.1, kind hex（陨石）/ bolt（落雷）, follow` |
| `grab` | 抓取后投掷 | `reach 62, hold 0.8, dmg 0.5, throwDmg 1.5, windup 0.5` |
| `summon` | 召唤 | `kind, n 2, max 3, lvlOff -1` |
| `blink` | 瞬移 | `to behind / front / away / center / random, dist 80`（常用 `then` 或放进 `seq`） |
| `buff` | 强化 | `kind enrage / shield / haste / heal, target self / allies, r 280, dur 8, amt 0.3` |
| `laser` | 激光扫射 | `windup 1.1（细线）, dur 1.2, hw 16, sweep 0（每秒沿纵深扫多少）, tick 0.2, zMax 34（跳起来能躲）` |
| `guard` | 格挡架势 + 反击 | `dur 2.4, reduce 0.8（正面减伤）, counter: 技能 spec（默认自身周围冲击波）` |
| `explode` | 自爆（`suicide`）；死亡爆炸用特性 `onDeath` | `r 110, windup 0.9, dmg 1.6, suicide true` |
| `seq` | 连招：依次放出 `steps` 里的技能（领主的“剧本招式”） | `steps: [spec, ...]` |
| `mech` | 启动一个领主机制（比如隔段时间重新架盾） | `mech: 机制 spec`（同种机制还在时不会放） |

## 4. 领主机制库（`mechs` / `enter.mechs` / `{ use: 'mech' }`）

加新机制时组队也要一起写（net/coop_mech.js，见 docs/NETWORK.md「领主机制同步」）：随机出来的东西放进 `net(m, st, p)`（启动时发给队员），关键时刻调 `msNetEv(m, st, '事件', 数据)`，HUD 数值写 `netState(st)`；`mirror: { start, ev, update, end }` 在队员那边放同样的预警和攻击（只判定 `msSelf()`），不做结算。打玩家的循环要跳过队友影子（`t.ghost`）。

| 机制 | 作用 | 参数（默认值） |
|---|---|---|
| `groggy` | 破招槽：每次命中扣 `hit`，每 1% 最大 HP 的伤害扣 `dmg/100`；扣空 → 眩晕 `dur` 秒、受到的伤害 ×`mul`，然后回满。血条下有槽 | `max 100, hit 0.6, dmg 300, dur 7, mul 1.5` |
| `invuln` | 无敌阶段，直到条件满足：`until crystals`（击破 n 个水晶 `name`）/ `adds`（打倒 n 只 `kind`）/ `survive`（撑过秒数）/ `hook`（钩子里设 `m.msInvulDone`）。打水晶 / 小怪时领主默认离场（`hide`） | `n 4, hpFrac 0.025, survive 12` |
| `shield` | 可破护盾：`hp`×最大 HP（或 `hits` 次命中）挡住全部伤害；`dur` 秒没打破 → `punish heal / nova`；`onBreak: 'groggy'` 打破直接破招 | `hp 0.06, dur 0` |
| `safezone` | `windup` 秒后全屏重击（`frac`×最大 HP 真实伤害），站进安全区没事：`mode zone`（n 个光圈，半径 r）/ `near` / `far` | `windup 3.2, n 2, r 70, frac 0.45` |
| `hazard` | 场地危害：`kind fire`（目标附近地火）/ `debris`（全场落石）/ `shrink`（场地从两边缩小到 `minW`，暗区每秒 4%）；`dur 0` 一直持续 | `every 4, n 2, r 50, speed 22` |
| `enrage` | 狂暴计时（DPS 检查）：`t` 秒后攻击 ×`atk`、移速 ×`speed`、出招间隔 ×0.6；血条右侧倒计时 | `t 180, atk 1.8, speed 1.3` |
| `clones` | 分身：召出 n 个暗影（`<领主>Shade`，自动生成、压暗），领主混在里面；打中本体分身散掉，打死暗影 → `punish nova`（原地爆炸）/ `heal` | `n 3, hp 0.015, dur 14` |
| `element` | 属性切换：领主在 `modes` 之间轮换，场上两个颜色法阵；站在相克颜色（亮破暗、暗破亮）的法阵里打才有全额伤害，否则 ×`mul` | `modes [light, dark], every 12, mul 0.35, r 95` |
| `tether` | 连线：召出搭档 `kind`（血量 `hp`×领主最大 HP）；`mode guard`（领主伤害 ×`mul`）/ `share`（伤害分担）/ `close`（靠近时互相回血）；搭档倒下 → `onBreak: 'groggy'` | `mul 0.35, hp 0.2, dist 180` |

### 什么时候用机制库，什么时候写钩子
- 先用机制库：以上九种能组合出绝大多数领主（希洛克 = 破招 + 狂暴 + 分身 + 无敌（记忆碎片）+ 连线（卢克西）+ 安全区 + 落石 + 场地缩小）。
- 只有机制库表达不了的判定才写钩子，例如希洛克的「凝视」要看玩家的朝向。钩子写在 `src/content/regions/<id>_bosses.js`：
  ```js
  REGION_HOOKS.<名字> = { onSpawn(m), onPhase(m, 阶段), update(m, dt), onHit(m, dmg, 攻击者, 命中), hud(c, m, x, y) };
  ```
  spec 里 `hook: '<名字>'`。钩子保持几十行、自成一体，其余招式照样用技能库。钩子里可以用 `msSay` `msTrueHit` `msMechStart` `MS_STATS`。

## 5. 美术流水线

`python3 art/tools/region_art.py <id> [阶段] [--only 前缀]`，阶段：`refs bg review1 sheets cut norm outline edge bgcut world icons review`（不写 = 全部）。
- `art.chars.<名字>`：`h` 站立高度（世界单位，玩家约 115）、`desc`、`hold`、`atk` `cast` `low`（动作表描述）、`fly` + `hover`（悬浮高度）、`cycle: 'trot'`（四足）、`holes: false`（白色系角色）、`outline: '#颜色'`（描边）。领主在游戏里的大小用怪物的 `scale` 调（希洛克 h 126 × 1.5 ≈ 190），不用重出图。
- 提示词自动加上：不画特效（烟 / 火花 / 光束 / 速度线由游戏运行时画）、不用纯绿和品红。`review` 阶段会统计每个角色帧里的纯绿 / 品红像素，超过 0.4% 标红。
- 生图并发 2，429 退避 90 秒；已有的输出跳过。

## 6. 测试

`node test/region.mjs <id> [data,skills,mechs,monsters,scenes,quest,bot]`（只开一个无头浏览器）：
- `data`：怪物 / 主题 / 精灵分包 / 背景 / 门 / 掉落 / 图标 / 任务链 / `validateWorld()` 全部干净。
- `skills`：样品怪 `msLab` 把技能库每个技能放一遍（格挡被打会反击、抓取能抓住、召唤有小怪、范围技能有预警）。
- `mechs`：破招槽会破、无敌阶段满足条件就结束（水晶 / 撑过）、护盾挡伤害并能打破、安全区里没事外面挨打、地火 / 缩圈、狂暴、分身（打本体散、打暗影炸）、属性切换、连线（搭档死 → 破招）、钩子（凝视）、阶段切换。
- `monsters`：每个怪物 / 领主 / 暗影有逐帧精灵、会出手、领主每招都能强制放出、能打死。
- `scenes`：每个场景能进、背景和 NPC 立绘加载、每个出口来回走通、入口的等级限制。
- `quest`：主线从头做到尾。
- `bot`：机器人以各地下城自己的等级、全身 +12 史诗通关每个地下城（`BOT=law_gate:sword,...` 可改分配），要求通关、用时不超限、死亡 ≤ 2、被击 ≤ 160。
  调难度用 `GEAR=rare`（全身同等级稀有 +7，`ENH=` 可改）或 `GEAR=base`（只有 testLoadout），`LV=` 强制等级；把老区域的同类地下城放进同一个 `BOT=` 一起跑当对照。
`test/quick.sh` 跑前五个快的部分；`test/all.sh` 跑全部。

## 7. 已知的坑
- 全身 +12 史诗的 Lv30 角色非常强：第一版按天帷巨兽的数值跑，普通图 90 秒通关、领主 20 秒就倒。难度一律用 `power / bossPower / atkPower` 调，机器人实测（`power 6.5, bossPower 0.75, atkPower 3.2`）：法则之门 150 秒、知性之门 256 秒、痛苦之门 194 秒、攻坚无形棺柩 282 秒，被击 27~88 次，0 死亡。同一职业的史诗是随机的，攻击力能差 50%，每张图至少跑两次再下结论。
- 领主会死 = 地下城结算（`t.boss` 的怪死了就 `bossDown`）：连线搭档、分身、水晶都**不能**带 `boss` 标记，生成器已经处理。
- 机器人只会打最近的怪（领主优先）：需要打小怪 / 水晶的无敌阶段要让领主离场（`hide`，默认），否则机器人会一直打无敌的领主。
- 场景的内容校验要求美术齐全（背景、NPC 立绘）。美术没出完之前 `data` 部分会报缺素材，这是正常的。
- 任务的 `pre` 接上一个区域的最后一个主线；入口场景没有加载时（另一个区域的内容包不在）入口不会加上，内容校验会报“走不到”。
- 暗影的精灵是领主精灵压暗（`bright 0.62`），太暗的领主可以在 spec 里给暗影单独写 `art`。
