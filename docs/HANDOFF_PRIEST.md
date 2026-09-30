# 男圣职新增任务交接

更新时间：2026-09-30

## 用户目标

按当前国服完整版本新增男圣职：基础职业 + 圣骑士、蓝拳圣使、驱魔师、复仇者四个转职，技能、一次觉醒、二次觉醒、三次觉醒全量对齐，并扩大现有等级与装备体系。用户已明确选择“当前国服完整版本”，所以不能把现有 Lv.60 数值直接冒充当前版本；当前官方资料基线是 Lv.115，现有项目的 Lv.60 只能作为兼容层。

## 已完成且已提交

- `b342cf4 docs(priest): add current male priest skill research`
  - 新增 `docs/SKILLS_OFFICIAL_priest.md`。
  - 覆盖基础男圣职、四个转职、觉醒、网络同步、Lv.115/Lv.60 迁移说明。
  - 官方无法公开核对的逐级数值明确标记为 `UNVERIFIED`。
- `31df371 feat(priest): add male priest base class slice`
  - 新增 `src/content/classes/priest.js`。
  - 已登记 `CLASSES.priest`、男圣职基础属性、模型回退、普攻、基础技能、武器标签、技能栏和四个转职占位。
  - 该文件单独 `node --check` 已通过。

## 当前工作区未提交改动（主线程已移到分支 `priest/wip`，main 工作区已恢复干净）

这些改动来自主线程，尚未完成构建验证：

- `src/ORDER`：已加入 `content/classes/priest.js` 和 `content/classes/priest_crusader.js`。
- `src/game/items.js`：已加入十字架、念珠、战斧、图腾、镰刀五类武器及 `priest: cross` 初始武器。
- `src/game/progress.js`：已加入 `crusader / monk / exorcist / avenger` 防具精通映射。
- `src/game/duel.js`：已加入 Priest PvP 基准属性及四个转职占位修正。
- `server/modules/arena.js`：已把 Priest 基础职业和四个转职加入 AI 池。
- `src/content/classes/priest_crusader.js`：当前新增文件，已实现圣骑士骨架，尚未提交。
- （更正）`test/affected.mjs` 是主线程加的“只跑受影响测试”工具，已提交在 main，不属于圣职者的改动。

当前执行结果：

- `node --check src/content/classes/priest.js`：通过。
- `node --check src/content/classes/priest_crusader.js`：通过。
- `node --check` 对本轮修改的 `items.js / progress.js / duel.js / server/modules/arena.js`：通过。
- `git diff --check`：此前通过。
- `node build.mjs`、`sh test/quick.sh`：尚未执行；不能宣称整体构建或测试通过。

## 圣骑士当前内容

`src/content/classes/priest_crusader.js` 使用全局脚本架构，不使用 import/export。已登记：

- 辅助与被动：神的恩赐、勇气恩赐、守护恩赐、板甲专精、冥想、信念光环。
- 祝福与保护：武器祝福、天使祝福、荣誉祝福、守护徽章、天籁之音、圣光守护、圣光沁盾、圣光之盾·神圣守护、光之复仇。
- 治疗与复活：净化、缓慢愈合、快速愈合、生命源泉、生命之泉、圣愈之风。
- 输出：纯白之刃、胜利之矛、圣光之墙、忏悔之锤、正义审判、圣灵之槌。
- 觉醒：天启之珠、神罚·圣光十字、圣光怒火·阿斯特拉佩、最终审判。

这些技能是当前引擎可运行的近似骨架，不是逐帧复刻。`partyCast`、`partyRevive`、`addAbsorb` 等联机/队伍 API 均做了存在性判断，仍需实际构建和联机测试确认。

## 尚未完成的核心工作

1. 新增 `priest_monk.js`、`priest_exorcist.js`、`priest_avenger.js`，并把四个转职从 `ready:false` 改为可用。
2. 将四个转职文件加入 `src/ORDER`，保证顺序在 `content/classes/common.js` 和基础 Priest 文件之后。
3. 为四个转职补完整技能清单、被动、核心机制、三觉、`skills/start/bar/cmds` 和觉醒字段。
4. 补任务与导师：`src/content/quests/job.js` 的 Priest 链、导师/NPC、转职/觉醒任务；必要时新增 `src/content/quests/priest.js`。
5. 补装备内容：基础装备、Lv.60 兼容装备、当前版本 Lv.115 迁移方案、圣职者史诗武器/防具/首饰；不能只改 `WTYPES`。
6. 补网络与表现层：`SPR_DATA`、职业外观、`src/net/town.js` / `src/net/coop.js` 的 Priest 回退逻辑、联机职业同步。
7. 补测试：基础职业 smoke、四转职技能清单、觉醒、PvP、排位 AI、装备可装备性、队伍祝福/治疗/复活。
8. 处理等级迁移：现在 `src/game/progress.js` 仍是 `MAX_LVL = 60`。切到 Lv.115 需要同步经验、技能等级、装备等级、掉落、地下城门槛和旧存档兼容，不能单独把常量改成 115。

## 官方与研究来源

- [Neople 男圣职者职业页](https://www.dfoneople.com/gameinfo/character/Priest(M)?mobile-app=true&theme=wiki)：四个转职、武器和职业定位。
- [Neople 圣骑士平衡页](https://www.dfoneople.com/news/updates/686/Character-Balance/Priest/Crusader)：圣灵之槌、圣光沁盾、圣光之盾等机制方向。
- [Neople Lv.115 公告](https://www.dfoneople.com/news/notices/4385/Director%27s-Note---March-2025)：等级上限扩展基线。
- [Huiji 男圣职者资料](https://dnfcn.huijiwiki.com/wiki/%E5%9C%A3%E8%81%8C%E8%80%85%EF%BC%88%E7%94%B7%EF%BC%89)：技能名、转职和机制交叉核对。
- [Fandom 圣骑士资料](https://dnf.fandom.com/zh/wiki/%E5%9C%A3%E9%AA%91%E5%A3%AB(%E7%94%B7))：技能/觉醒名称和旧版本资料交叉核对。

## 接手建议

先不要直接把所有文件一次性改完。建议按以下顺序，每步都构建和跑受影响测试：

1. 先确认并提交当前 Priest 基础切片、系统接线和 `priest_crusader.js`。
2. 一次只新增一个转职文件，完成 `node --check`、构建、职业 smoke，再进入下一个转职。
3. 四个转职稳定后再接任务、装备、网络和表现层。
4. 最后单独开 Lv.115 迁移批次，保留 Lv.60 兼容层；所有无法从官方资料核对的数字继续标记 `UNVERIFIED`。

## 接手前检查命令

```sh
cd /Users/luzhipeng/projects/dawnbreak
git status --short --branch
git log --oneline -6
node --check src/content/classes/priest.js
node --check src/content/classes/priest_crusader.js
node build.mjs
sh test/quick.sh
```

注意：项目所有前端脚本通过 `src/ORDER` 拼接到同一全局作用域，不能使用模块 import；新增函数和常量必须避免与既有文件重名。提交遵循 Conventional Commits。
