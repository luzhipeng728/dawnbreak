/* =====================================================================
   圣职者转职：复仇者（`avenger`，技能前缀 pa_）—— 空壳（B0，docs/CLASS_PLAN_PRIEST.md §4）
   元数据（名字 / 精通 / 伤害类型 / 成长 / 三次觉醒名 / ready:false）已在 content/classes/priest.js 的 CLASSES.priest.jobs.avenger 登记；
   本转职块在这里：CLASSES.priest.jobs.avenger.skills.push(...)、Object.assign(CLASSES.priest.jobs.avenger.anims, ...)、往 PRIEST_HOOKS / PRIEST_ACT_PICK 登记。
   要点：重甲；暗属性魔法；恶魔能量槽、半魔化 / 魔化（PRIEST_ACT_PICK 换普攻）、化魔改写、恶之再临（BUFF life）
   ===================================================================== */
