/* =====================================================================
   职业：鬼剑士（技能见 sword_skills.js，基础动作见 game/player.js 的 SWORD_ACTS）
   ===================================================================== */
Object.assign(CLASSES.sword, {
  name: '鬼剑士', desc: '左臂寄宿着鬼神的剑士。连段流畅、浮空强势，指令技能丰富。', model: () => buildSwordsman(),
  skills: ['upslash', 'triple', 'wave', 'slam', 'focus', 'iai', 'spin', 'flurry', 'rise', 'awaken'],
  start: ['upslash', 'triple', 'wave', 'spin'], bar: ['upslash', 'triple', 'wave', 'spin', null, null, null, null, null, null, null, null],
});
function cmdLabel(cls) { for (const [seq, id] of CLASSES[cls].cmds) if (SKILLS[id]) SKILLS[id].cmdTxt = `指令：${cmdText(seq)}+Z`; }
