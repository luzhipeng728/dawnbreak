/* =====================================================================
   圣职者转职：蓝拳圣使（`monk`，技能前缀 pi_）—— 空壳（B0，docs/CLASS_PLAN_PRIEST.md §4）
   元数据（名字 / 精通 / 伤害类型 / 成长 / 三次觉醒名 / ready:false）已在 content/classes/priest.js 的 CLASSES.priest.jobs.monk 登记；
   本转职块在这里：CLASSES.priest.jobs.monk.skills.push(...)、Object.assign(CLASSES.priest.jobs.monk.anims, ...)、往 PRIEST_HOOKS / PRIEST_ACT_PICK 登记。
   要点：轻甲；物理；意念驱动（插在地上的巨兵光环区域，普攻换拳：PRIEST_ACT_PICK）、俯冲 / 摆动、神圣反击、干涸之泉（PRIEST_HOOKS.cancelHook）
   ===================================================================== */
