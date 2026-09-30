/* =====================================================================
   圣职者转职：圣骑士（`crusader`，技能前缀 pc_）—— 空壳（B0，docs/CLASS_PLAN_PRIEST.md §4）
   元数据（名字 / 精通 / 伤害类型 / 成长 / 三次觉醒名 / ready:false）已在 content/classes/priest.js 的 CLASSES.priest.jobs.crusader 登记；
   本转职块在这里：CLASSES.priest.jobs.crusader.skills.push(...)、Object.assign(CLASSES.priest.jobs.crusader.anims, ...)、往 PRIEST_HOOKS / PRIEST_ACT_PICK 登记。
   要点：板甲；伤害类型 mag（技能多为独立攻击 indep）；全队祝福 / 治疗 / 复活 / 护盾（net/party_sync.js）
   ===================================================================== */
