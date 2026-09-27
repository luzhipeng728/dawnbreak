/* =====================================================================
   事件总线：各系统之间解耦（任务、成就、统计、教程都靠监听事件，不用改战斗 / 地下城代码）
     bus.on('kill', e => ...)      bus.emit('kill', {...})
   已有事件（新增事件请在这里登记）：
     kill         { kind, lvl, boss, elite, dungeon, x, y } 地下城里击杀一只怪（x/y 为怪物位置）
     dungeonClear { id, diff, rank, time, hurt, maxCombo }  地下城通关（结算时）
     dungeonEnter { id, diff }                             进入地下城
     roomEnter    { id, room, type }                       进入地下城房间（type: normal/elite/boss）
     playerHurt   { dmg }                                  玩家受到伤害
     playerDeath  { dungeon }                              玩家在地下城里倒下（进入复活倒计时）
     levelUp      { lvl }                                  升级
     pickup       { item }                                 捡起物品（金币不算）
     gold         { n }                                    获得金币
     sceneEnter   { id, kind }                             进入城镇 / 区域场景
     npcTalk      { id }                                   和 NPC 对话
     itemUse      { item }                                 使用消耗品
     equip        { item, slot }                           穿上装备
     jobChange    { job }                                  转职
     charLeave    { cls }                                  离开当前角色（返回角色选择），按角色缓存的状态请在这里清掉
     skillUse     { id }                                   玩家施放技能（由战斗模块 player.js 发出）
   ===================================================================== */
const bus = {
  map: {},
  on(ev, fn) { (this.map[ev] || (this.map[ev] = [])).push(fn); return () => this.off(ev, fn); },
  off(ev, fn) { const L = this.map[ev]; if (L) { const i = L.indexOf(fn); if (i >= 0) L.splice(i, 1); } },
  emit(ev, data = {}) { const L = this.map[ev]; if (!L) return; for (const fn of L.slice()) { try { fn(data); } catch (e) { console.error(`事件 ${ev} 的监听出错`, e); } } },
};
