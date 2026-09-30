# 领主 spec 写法手册（BOSS_SPEC · P0-E 原语速查）

> 给区域块（R1~R5，含 SIMPLE 任务）用：**只写数据，不读引擎**。规划见 `docs/BOSS_PLAN.md`，老的技能库 / 机制库见 `docs/REGION_PIPELINE.md` §3 / §4。
> 代码：技能 + 特性在 `src/game/mon_skills_ext.js`，机制 + 引擎在 `src/game/mon_skills.js`，领主房在 `src/game/dungeon.js`，组队镜像在 `src/net/coop_mech.js`。
> 样板：斯卡萨之巢（`src/content/regions/snow.js` 的 `skasa` / `SKASA_CHARGE` / `SKASA_FLY`），总览图 `test/shots/skasa_s1/contact.jpg`。

**写之前记住五条**
1. 大招预警 ≥ 0.9 秒（默认值都够），每招都要有生路（背后 / 安全道 / 跑开 / 掩体 / 跳起来）。
2. 招牌至少 2 个，优先用下面的新原语；老的 13 个技能照样能用。
3. 要被 stance / form 点名的招式写 `id`；`id` 在同一个领主里唯一。
4. `art` / `runner` / form 的 `art` 只能写**已经有精灵**的名字（美术队列没出图之前先用现有底图 + `{ hue, sat, bright }`）。
5. 写完跑：`node build.mjs && node test/region.mjs <区域> data,skills,mechs,monsters`，再 `node test/boss.mjs <地下城>`（P0-T 的工具）。

公共参数（所有技能都能写，见 REGION_PIPELINE §3）：`clip range dy cd w dmg stun knock down launch elem status sdur sa say col fx then hp phase adds crowd id`。
`clip` 多了三个招牌动作：`'sigA' | 'sigB' | 'rage'`（§5）。

---

## 1. 技能（`skills: [{ use, ... }]`）

### leap 跳砸 / 升空追踪落地
下蹲 → 升空（不可选中）→ 地面圈跟着目标 `track` 秒 → 锁定 → `fall` 秒落下 → 冲击。生路：锁定后跑出圈；`ring` 内圈安全；`jump: true` 跳起来躲。

| 参数 | 默认 | 说明 |
|---|---|---|
| `crouch up track fall` | 0.35 / 0.5 / 1.2 / 0.7 | 各段时长（秒） |
| `r` / `ring: [r0, r1]` | 110 / — | 圆形半径；双环 = 内圈 r0 安全、外圈 r1 |
| `dmg jump down n hover` | 1.6 / false / true / 1 / 520 | `n` 连跳几次 |
```js
{ use: 'leap', id: 'ascend', track: 1.4, fall: 0.7, r: 120, status: 'shock', cd: [12, 15], say: '艾克洛索升天了！' },
{ use: 'leap', ring: [60, 170], jump: true, n: 2, cd: [10, 13], say: '起跳砸地——跳起来！' },   // 布万加：双环 + 跳躲
```

### cone 扇形吐息 / 喷射
出手瞬间朝向定死 → `windup` 秒扇形预警 → `dur` 秒持续喷射（每 `tick` 秒结算一次，异常每人只上一次）。生路：绕到侧面 / 背后。

| 参数 | 默认 | 说明 |
|---|---|---|
| `ang len` | 70 / 260 | 张角（度）、长度 |
| `windup dur tick dmg` | 0.9 / 1.2 / 0.2 / 0.35 | `dmg` 是每一跳 |
| `sweep` | 0 | 每秒转多少度（从一侧扫到另一侧） |
| `jump` | false | 跳起来能躲 |
```js
{ use: 'cone', id: 'breath', clip: 'sigB', ang: 56, len: 380, windup: 1.0, dur: 1.4, dmg: 0.32, status: 'freeze', sdur: 0.8, cd: [8, 10], say: '极寒龙息——绕到侧面！' },
{ use: 'cone', ang: 40, len: 300, sweep: 60, status: 'blind', col: '#9aff6a', cd: [9, 12], say: '喷种子！' },   // 罗丁
```

### lanes 纵深分道奔袭 / 齐射
纵深分成 `lanes` 条，随机挑 `hit` 条（最多 lanes−1，**永远留一条**）→ 横贯全场的预警 → 从一侧扫过去。

| 参数 | 默认 | 说明 |
|---|---|---|
| `lanes hit` | 4 / 3 | |
| `kind` | 'wave' | `bolt` 整条落雷（同时）\| `wave` 地波 \| `runner` 奔袭的影子 \| `shot` 弹幕 |
| `runner` | — | kind: 'runner' 时借哪个怪物的精灵（已有精灵的怪物 id） |
| `speed windup from n gap jump` | 560 / 1.0 / 'side' / 1 / 1.3 / false | `from`: side 随机一侧 \| left \| right \| boss；`n` 波、每波间隔 `gap` |
```js
{ use: 'lanes', kind: 'bolt', lanes: 6, hit: 5, windup: 1.1, col: '#ffe070', cd: [10, 13], say: '直线落雷！' },          // 凯诺
{ use: 'lanes', kind: 'runner', runner: 'deHeadlessShade', lanes: 4, hit: 3, n: 2, speed: 620, cd: [14, 18], say: '梦魇奔袭！' },
```

### mark 头顶标记延迟结算
给目标头顶挂倒数，到点按 `mode` 结算：

| mode | 生路 |
|---|---|
| `burst`（默认） | 以他为中心爆炸，别和队友挤在一起 |
| `share` | 半径 r 里的人平摊，聚在一起 |
| `move` | 之后 `dur` 秒必须一直移动，站着不动每 `tick` 秒掉 `frac` |
| `cover` | 躲到掩体（`cover` 物件，默认 `msCover`）后面，否则挨狙 |

参数：`delay 1.5, r 120, dmg 1.6 | frac（按最大 HP）, n 1（标几个人）, jump, dur 3, tick 0.5`。普通难度伤害自动打 6 折。
```js
{ use: 'mark', id: 'curse', mode: 'burst', delay: 1.5, r: 130, dmg: 1.8, cd: [14, 18], say: '死亡诅咒！' },            // 摩根
{ use: 'mark', mode: 'cover', delay: 2.0, frac: 0.35, cd: [16, 20], say: '红点瞄准——躲到砖堆后面！' },               // 赫伊斯（配 arena cover）
{ use: 'mark', mode: 'move', delay: 1.0, dur: 4, frac: 0.03, cd: [18, 22], say: '注视者之眼——别停下！' },            // 三头犬
```

### plant 可破坏物件（蛋 / 图腾 / 炸弹 / 柱子 / 投石车）
刷 `n` 个物件，头顶引信 `fuse` 秒，**打掉就没事**，到点 `onFuse`。物件活着房间不算清完。

| 参数 | 默认 | 说明 |
|---|---|---|
| `kind` | 'msPlant' | 物件怪物 id（内置 `msPlant` 炸弹 / `msTotem` 图腾 / `msDecoy` 草人，或 spec 里写 `obj:` 的怪物，见 §3.1） |
| `n at spread max` | 1 / 'target' / 160 / 6 | `at`: target 目标脚下 \| self \| spots 全场均匀 \| random |
| `fuse` | 6 | |
| `hp` / `hits` | 0.01 / 0 | 领主最大 HP 的比例 / 固定打几下 |
| `onFuse` | 'explode' | `explode`（r / dmg）\| `hatch:<怪物>` \| `release:<怪物>x3` \| `heal`（领主回 heal×HP）\| `buff`（领主狂暴） |
| `root` | false | at: 'target' 时目标被定住，直到物件被打掉 / 到点 |
| `operator` | — | 旁边刷一个操作员，操作员死了物件跟着坏（投冰车） |
| `label` | '' | 头顶引信条上的字 |
```js
{ use: 'plant', id: 'eggs', kind: 'skasaEgg', n: 3, at: 'spots', fuse: 12, hp: 0.012, onFuse: 'hatch:babySkasa', max: 3, label: '孵化', cd: [22, 26], say: '在孵化前打碎龙蛋！' },
{ use: 'plant', kind: 'crocPillar', at: 'target', root: true, hits: 4, fuse: 5, onFuse: 'explode', r: 100, cd: [15, 19], say: '鳄鱼柱！' },
```

### pool 地面残留区（毒 / 油 / 冰 / 减速 / 失明 / 火）
落点预警 → 落地 → 地上留 `linger` 秒，站在里面按 `zone` 生效。`zone: 'oil'` 被**火属性**的落点（`elem: 'fire'` 或 `ignite: true`）点着会连环爆炸。
参数：`at target|self|front, n, r 70, windup 0.9, linger 6, zone poison|oil|ice|slow|blind|fire, dmg 0（落地冲击）, tick 0.5, frac 0.02（fire 每跳）, boom 1.4（油爆）`。
`trail: true` = 这招变成“接下来 `dur` 秒走过的地方每 `every` 秒留一块”。老的 `aoe` 也能写 `linger: 6, zone: 'poison'` 落地后留区。
```js
{ use: 'pool', zone: 'poison', at: 'self', r: 90, linger: 8, cd: [12, 15], say: '毒雾！' },
{ use: 'pool', trail: true, zone: 'oil', dur: 8, every: 0.4, r: 40, cd: [14, 18], say: '汽油漏了一地……' },            // 本汀克
{ use: 'aoe', shape: 'circle', at: 'target', r: 80, elem: 'fire', ignite: true, cd: [7, 9], say: '轰爆弹！' },       // 点燃油
```

### pull 吸 / 推
`windup` 秒预警圈 → 一下爆发（`status` + `dmg`，可选）→ `dur` 秒把圈里的人吸向 / 推离领主。
参数：`mode in|out|toward（或 'toward:<物件>'）, to, r 400, force 260, dur 1.5, windup 0.9, status, sdur, dmg 0`。
```js
{ use: 'pull', id: 'blow', mode: 'out', r: 340, force: 320, dur: 1.1, status: 'stun', sdur: 0.9, cd: [13, 16], say: '吹气！' },
{ use: 'pull', mode: 'toward:bonfire', r: 500, force: 220, dur: 2, cd: [16, 20], say: '咆哮——被吹向火堆！' },       // 乌塔拉
{ use: 'pull', mode: 'in', r: 450, force: 200, dur: 2.2, then: { use: 'rain', kind: 'bolt', n: 8 }, cd: [20, 24], say: '磁场黑洞！' },
```

### dash 的变体（在老的 `dash` 上加参数）
| 参数 | 作用 |
|---|---|
| `carry: true` | 顶着第一个撞到的人一路推到墙边，撞墙连打 3 下再扔出去 |
| `spin: true` | 旋转着冲（多段） |
| `bounces: n` | 撞墙反弹 n 次（整条纵深都有预警） |
| `wallStun: 秒` | 撞到墙自己晕（反击窗口） |
| `frac: 0.3` | 撞中按最大 HP 结算（× 难度系数） |
```js
{ use: 'dash', carry: true, speed: 700, windup: 0.9, cd: [9, 12], say: '冲撞！' },                                   // 无头骑士顶墙
{ use: 'dash', bounces: 2, wallStun: 2, speed: 900, cd: [12, 15], say: '弹射！' },                                  // 艾克洛索
{ use: 'dash', frac: 0.5, windup: 1.6, len: 600, cd: [16, 20], say: '蓄力突刺！' },                                 // 鲁卡斯
```

### hold 读条（一般不用直接写）
`{ use: 'hold', dur: 2 }`：原地霸体读条。stagger 内部用它。

---

## 2. 机制（`mechs` 出场就有 / `enter.mechs` 进阶段 / `{ use: 'mech', mech, cd, gap }` 当招式放）
`{ use: 'mech', ... }` 新增 `gap: 秒`：同种机制**结束后**至少隔 gap 秒才再放（form / stagger 这种持续好几秒的一定要写）。

### stagger 蓄力破招窗口
领主霸体读条 `windup` 秒（头顶打断条 + 血条下的进度）；期间打够 `need`×最大 HP 的伤害（或 `hits` 次）→ 打断 + `onBreak`（有破招槽就破招，否则眩晕 `stun` 秒）；没打断 → 放出 `skill`（普通难度伤害打 6 折）。
```js
const XX_CHARGE = { use: 'stagger', windup: 3.2, need: 0.035, onBreak: 'groggy', say: '蓄力中——打断它！',
  skill: { use: 'cone', ang: 120, len: 520, windup: 0.4, dur: 1.2, dmg: 0.6, status: 'freeze' } };
// 阶段：{ at: 0.7, enter: { mechs: [XX_CHARGE] }, skills: [{ use: 'mech', mech: XX_CHARGE, cd: [26, 32], gap: 18 }] }
```

### form 形态切换
换精灵（`art`，必须已有）/ 体型（`scale` 倍）/ 浮空（`fly` 高度，飞着只能远程打到）/ 招式表（`skills`：对象 = 这个形态自带的招式，字符串 = 已有招式 id）；`replace`（有 skills 时默认 true）= 只放形态的招式；`dur` 秒后变回（0 = 一直到倒下），`land` = 变回来时接一招；`invulT` 过渡无敌。
```js
const XX_FLY = { use: 'form', name: '升空', fly: 190, dur: 12, invulT: 1.5, say: '飞上了天空——躲开冰雨！',
  skills: [{ use: 'rain', kind: 'hex', n: 7, r: 50, windup: 1.2, cd: [3.2, 4.2] }], land: { use: 'aoe', at: 'self', r: 170, windup: 0.9 } };
{ at: 0.4, enter: { mechs: [{ use: 'form', art: 'trAnzuMech', scale: 1.1, dur: 0, skills: ['rocket', { use: 'pull', mode: 'in' }], say: '安祖变身了！' }] } }
```

### stance 模式轮换（不换图）
`modes: [{ id, name, col, say, skills: [...], replace, dmgTaken, reflect: 'phys'|'magic'|'ranged'|'melee'|'all', reflectK, invis: 0~1, speed, atk }]`，`every: [12, 16]` 秒轮换，或 `at: [0.6, 0.3]` 按血量切。
模式点名的招式 id **只在这个模式**可用；没被点名的招式一直可用；`replace: true` = 只放这个模式的招式。
```js
mechs: [{ use: 'stance', every: [12, 15], modes: [
  { id: 'move', name: '移动模式', col: '#ffb030', skills: ['charge', 'missile'], dmgTaken: 1 },
  { id: 'guard', name: '防御模式', col: '#6ab0ff', skills: ['quantum'], dmgTaken: 0.4, speed: 0.4 }] }]            // GT-9600
```

### duo 多领主同场
`with: [怪物 id...]`（区域领主或普通怪都行），搭档也算领主：**全部倒下才结算**，掉落只在最后一个倒下时掉；血条下面叠小血条。
`hp 1`（搭档血量倍率）、`onPartnerDown: 'enrage'`（其余的 攻击 ×`atk` 移速 ×`speed` 出招更快）| `'none'`、`window: 0`（>0 = 必须 n 秒内一起倒下，否则倒下的按 `reviveHp` 复活）。
```js
mechs: [{ use: 'groggy', max: 110 }, { use: 'duo', with: ['sabertooth'], window: 0, say: '鲁乌格和冰齿沙凡特一起上了！' }]
mechs: [{ use: 'duo', with: ['titan', 'atlas'], window: 10, say: '三兄弟要在 10 秒内一起打倒！' }]
```

### gauntlet 车轮战
命名精英一波一波上场，领主无敌：`boss: 'watch'`（站着观战）| `'hide'`（离场）。
`waves: [{ kind, n, name, hp, elite, mechs: [...], say }]`、`gap 1.5`、`window`（这一波 n 秒内没全倒就复活）、`done`（领主上场台词）。
```js
{ at: 1, enter: { mechs: [{ use: 'gauntlet', boss: 'watch', waves: [
  { kind: 'wKnight', name: '风之骑士', mechs: [{ use: 'stance', modes: [{ id: 'hide', invis: 0.85 }] }] },
  { kind: 'gKnight', name: '守护骑士', mechs: [{ use: 'stance', every: [8, 8], modes: [{ id: 'red', reflect: 'phys', col: '#ff5a5a' }, { id: 'blue', reflect: 'magic', col: '#6ab0ff' }] }] }] }] } }
```

### arena 场地规则
| kind | 参数 | 说明 |
|---|---|---|
| `fog` | `r 260` | 自己周围 r 以外压暗 |
| `wind` | `vx -70` | 一直被吹向一侧（每秒 vx） |
| `tiles` | `cols 6, hot 0.5, every 6, warn 1.2, frac 0.05, tick 0.5` | 地砖：闪烁 warn 秒后变烫，每 every 秒换布局，至少留一格安全 |
| `cover` | `n 3, cover 'msCover'` | 刷掩体（配 mark cover） |
| `slide` | `slide 0.92` | 冰面，停下时会滑 |
公共：`dur 0`（0 = 一直）、`say`、`col`。
```js
mechs: [{ use: 'arena', kind: 'fog', r: 240 }, { use: 'arena', kind: 'cover', n: 3 }]                       // 赫伊斯
{ at: 0.6, enter: { mechs: [{ use: 'arena', kind: 'wind', vx: -80, say: '异界之风！' }] } }                  // 昔日悲鸣
```

### protect 保护 / 护送
刷一个要保护的物件 `kind`（玩家打不动），`threat` 的小怪会被它吸引，摸到扣一条命（`onTouch: 'heal'` 领主回 `heal`×HP）；命用完 → `onLose`：`enrage | heal | nova | fail`（全队真实伤害 `frac`）。
`escort: { to: 'boss' | 0~1, speed }` = 物件自己往前走，到了 `onArrive: 'groggy' | 'hurt'`。`spawn: { kind, n, every }` 定时从远端刷小怪。
```js
mechs: [{ use: 'protect', kind: 'charlieHeart', lives: 5, at: 0.15, threat: 'toySoldier', spawn: { kind: 'toySoldier', n: 2, every: 9 }, onTouch: 'heal', heal: 0.03, say: '保护查理的心脏！' }]
```

### facing 朝向判定（凝视的通用版）
`windup 1.8` 秒后结算；`mode: 'away'` 面朝领主的挨 `frac` + `status`；`'toward'` 背对的挨。
```js
{ use: 'mech', mech: { use: 'facing', mode: 'away', windup: 1.8, frac: 0.12, status: 'stun', sdur: 1.5 }, cd: [16, 20], gap: 8 }
```

---

## 3. 特性（`traits: { ... }`）
| 特性 | 写法 | 作用 |
|---|---|---|
| `hitHp` | `hitHp: 6` | 固定 6 下打碎（每下恒为 1） |
| `saVsRanged` | `saVsRanged: 1.2` | 被远程打中霸体 1.2 秒（逼玩家贴身） |
| `reflectRanged` | `{ on: 3, off: 6, k: 0.3, mul: 0.3 }` | 周期性反射罩：亮着时远程攻击反弹 k×伤害（每下最多 6% 最大 HP），自己只受 mul 倍 |
| `rooted` | `rooted: true` | 不走、不被击退 |
| `back` | `'interrupt'` 或 `{ interrupt, stun, do: 技能, cd }` | 被背后打中：打断霸体大招 + 眩晕 / 立刻放一招 |
| `onGetup` | 技能 spec 或 `{ do, cd }` | 倒地起身立刻反击 |
| `grabOnly` | `true` | 一直霸体，抓取技能打中才破霸体（1.2 秒） |
| `stacks` | `{ n: 6, dur: 8, r: 110, frac: 0.12 }` / `{ target: 'self', n, do }` | 打它的人头上叠炸弹，满 n 层脚下爆；self = 自己叠满放 do |
| `substitute` | `{ cd: 12, heavy: 0.02, summon: { kind, n } }` | 挨重击（单下 ≥2% 或被打浮空 / 倒地）留草人、自己闪走 |
| `trail` | `{ zone: 'oil', every: 0.6, r: 36, linger: 8 }` | 一直在走过的地方留区域 |
老的 `sa immune onDeath regen reflect` 照旧。

### 3.1 物件怪（蛋 / 心脏 / 掩体 / 图腾）
怪物 spec 写 `obj: { shape, col, h, cover?, botSkip? }` 就是不动、不出手、程序画的物件（不用出图，也不进 `R.monsters`，不查精灵）：
`shape`: `egg | heart | block | dummy | totem | pillar | bomb`；`cover: true` = mark cover 认它当掩体；`botSkip: true` = 机器人不打它。
```js
skasaEgg: { name: '冰龙之卵', tier: 'swarm', size: [18, 12, 64], obj: { shape: 'egg', col: '#cfeeff', h: 64 } },
brickPile: { name: '砖堆', size: [30, 14, 90], obj: { shape: 'block', col: '#9a8a7a', h: 90, cover: true }, traits: { hitHp: 20 } },
```

## 4. 老领主（1~30 级，手写 AI 不动）：`defineBossKit`
写在区域块自己的文件里（如 `content/bosses/grand_flores.js`，ORDER 放在 region.js 之后）。只在当领主刷出来时生效。
```js
defineBossKit('tauKing', {
  mechs: [{ use: 'groggy', max: 80 }], traits: { onGetup: { use: 'aoe', at: 'self', r: 140, windup: 0.6 } },
  skills: [{ use: 'dash', wallStun: 2, id: 'ram', cd: [9, 12] }],
  phases: [{ at: 0.5, say: '萨乌塔举起了巨斧！', skills: [{ use: 'mech', mech: { use: 'stagger', windup: 3, need: 0.05, skill: { use: 'aoe', at: 'front', r: 150, dmg: 2 } }, cd: [20, 26], gap: 12 }] }] });
```
阶段字段：`at say col roar heal summon mechs skills only`。form / stance 的 `replace` 对手写招式也生效。

## 5. 招牌动作（sig）
技能写 `clip: 'sigA' | 'sigB' | 'rage'`。精灵有 `sigA1~sigA4 / sigB1~sigB4 / rage` 帧就用（美术队列按 3×3 出一张 sig 表：第 1 行 sigA、第 2 行 sigB、第 3 行 rage + 空），没有就退回 atk / cast 帧，可以先写数据后出图。
`art.chars.<名字>.sig: ['招式 A 的动作描述', '招式 B 的动作描述']` 给美术队列看。

## 6. 领主房（地下城字段）
| 字段 | 写法 | 说明 |
|---|---|---|
| `bossTheme` | `'snNestBoss'` | 领主房单独的背景（`themes` 里要有；没出图时用程序兜底画面） |
| `bossProps` | `[{ kind: 'throne' \| 'chain' \| 'cage' \| 'pillar' \| 'bones' \| <怪物 id>, x: 0~1, y: 0~1, h, col, art }]` | 摆设；怪物 id 的由主机刷（投冰车、笼子…） |
| `bossAlt` | `{ kind, chance: 0.1, say }` | 稀有领主替换（素材没载完就不换；任务目标用 clear 别用 kill） |
| `bossBgm` | `'boss_<区域>'` | 区域自己的领主曲（B12） |
```js
skasa_nest: { ..., bossTheme: 'snNestBoss', bossProps: [{ kind: 'bones', x: 0.2, y: 0.1 }], bossAlt: { kind: 'skasaAncient', chance: 0.1 } }
```

## 7. 组队
只写配置不用管同步：技能按编号重播；随机结果（落点、分道、标记谁、物件、残留区）主机算好走 hook（`msLeap msLanes msMark msPlant msFuse msUnroot msPool msSub msRefl msDuo`）；机制走 `start / ev / end` 镜像。
要自己写钩子（`<id>_bosses.js`）时：随机的东西只在主机算，`msNetEv(m, null, 'hook', { h: '名字', ... })`，队员在 `MS_MIRROR.名字(m, d)` 重放；只判定本机玩家（`msSelf()` / `msMine(m)`）。
**临时拼的 spec（`msMechStart(m, { ...新对象 })`）里嵌套的招式在队员那边没有编号**——机制 spec 请写成常量（像 `SKASA_CHARGE`），放进 `mechs` / `enter.mechs` / `{ use: 'mech' }`，定义时预编译。

## 8. 调试钩子（test/boss.mjs 用，名字固定）
| 名字 | 用法 |
|---|---|
| `monForceSkill(m, i)` | 强制放一招：`i` = 招式表序号 \| 技能名 / 招式 `id`（也找机制里嵌套的预编译招式）\| 技能 spec 对象（现场编译，只能单机用）；返回 true/false |
| `bossPhaseSet(m, i)` | 直接进第 i 阶段（血量压到门槛下，进场机制照常启动），返回现在的阶段号 |
| `msMechStart(m, spec)` / `msMechEnd(m, st)` | 启动 / 结束一个机制 |
| `MS_EVENTS` | 数组，每条 `{ t 游戏秒, T 毫秒, ev, kind, nid, ... }`；`ev`: `cast`（id 技能名、sid 招式 id）\| `tele`（k 类型、r 半径）\| `mech`（id）\| `end`（id、res）\| `solve` / `fail`（id、why）\| `hurt`（dmg、src 机制、me 本机）\| `phase`（i）。最多 3000 条 |
| `MS_STATS` | `cast[技能]`、`mech[机制]`、`mech[<机制>Solve / Fail]`、`plantBroken plantFuse poolIgnite wallStun backBreak onGetup grabBreak substitute duoDown facingHit facingSafe` |

测试：`node test/boss_prims.mjs`（每个原语的挨打 / 生路 / 解开 / 失败）、`node test/region.mjs <区域> skills,mechs`（样品怪放全部技能、新机制跑一遍）、`node test/skasa_s1.mjs`（S1 总览图 + 实机 40 秒）、`node test/mp_bossprims.mjs`（组队同步）。
