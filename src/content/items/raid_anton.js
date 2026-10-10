/* 安徒恩攻坚战奖励（Neo 版，Lv60）：团本货币「魔能矿」+ 融合材料「荒古融合核」+ 三套融合装备（贪食 / 荒古 / 魔能，每套 4 个词条可选）。
   数值预算见 docs/RAID_PLAN.md §4.3：融合件的 fx 略低于希洛克（Lv62 < 63，dmgUp 0.16~0.19 < 0.18~0.22），高于同等级普通史诗。
   装备 key 命名 raid_an_<套>_<序号>，与 src/game/raid_anton.js 里的奖励 pick 列表一一对应（服务端看不到物品库，所以那边写死了 key）。
   物品图标 item_<key> 由美术批次产出（docs/RAID_ART_MANIFEST.json）；没有图时走物品通用占位。 */
defineItem('raid_magic_ore', { kind: 'mat', name: '魔能矿', rar: 4, price: 1200, sellMul: 0.05, col: '#ff7a4a', icon: 'item_raid_magic_ore', noSell: true, desc: '安徒恩体内凝结的魔能结晶。完成攻坚阶段后获得，可在安徒恩攻坚商店兑换。' });
defineItem('raid_an_core', { kind: 'mat', name: '荒古融合核', rar: 4, price: 1800, sellMul: 0.05, col: '#ff4a3a', icon: 'item_raid_an_core', noSell: true, desc: '安徒恩的心脏碎片炼成的融合材料，可在攻坚商店兑换安徒恩融合装备。' });
const ANTON_RAID_GEAR = [];
function defineAntonFusionSet(id, name, slot, options, desc) {
  defineSet(id, { name, epic: true, fusion: true, bonus: { 1: { st: { dmgUp: 0.07 }, desc: '融合装备伤害增加 7%。' } } });
  for (const [i, o] of options.entries()) {
    const key = `raid_an_${id.replace('set_anton_', '')}_${i + 1}`;
    defineGear(key, { rar: 5, tier: 4, lvl: 62, slot, ...(slot === 'bottom' ? { atype: 'light' } : {}), name: o.name, icon: 'item_' + key, fx: o.fx, proc: o.proc, set: id, desc: `${desc}${o.desc ? ` ${o.desc}` : ''}（安徒恩独立融合装备）`, src: '安徒恩攻坚战翻牌、荒古融合核兑换' });
    SETS[id].pieces.push(key); ANTON_RAID_GEAR.push(key);
  }
}
defineAntonFusionSet('set_anton_gluttony', '贪食融合', 'bottom', [
  { name: '贪食：吞噬', fx: { dmgUp: 0.17, str: 66, int: 66, cdr: 0.03 }, desc: '技能命中后 3 秒内伤害额外 +6%。' },
  { name: '贪食：饥渴', fx: { dmgUp: 0.16, cdr: 0.08, elemAll: 22 } },
  { name: '贪食：獠牙', fx: { dmgUp: 0.18, fire: 40, critDmg: 0.09 }, proc: { on: 'skill', chance: 0.12, cd: 1.8, act: 'strike', mul: 2.6, elem: 'fire', vis: 'fire', name: '贪食獠牙' } },
  { name: '贪食：饱足', fx: { dmgUp: 0.17, allStat: 42, hpPct: 0.08 }, proc: { on: 'lowhp', cd: 40, act: 'heal', hp: 0.2, name: '饱足回生' } },
], '贪食之躯的融合下装，基础伤害与等级均超过现有 Lv60 史诗。');
defineAntonFusionSet('set_anton_primeval', '荒古融合', 'ring', [
  { name: '荒古：烈焰', fx: { dmgUp: 0.17, fire: 40, aspd: 0.05, cdr: 0.03 }, proc: { on: 'skill', chance: 0.1, cd: 1.8, act: 'strike', mul: 2.4, elem: 'fire', vis: 'fire', name: '荒古烈焰' } },
  { name: '荒古：寒渊', fx: { dmgUp: 0.17, ice: 40, cspd: 0.05, cdr: 0.04 } },
  { name: '荒古：雷鸣', fx: { dmgUp: 0.17, light: 40, critDmg: 0.08 }, proc: { on: 'crit', chance: 0.12, cd: 1.2, act: 'strike', mul: 2.6, elem: 'light', vis: 'holy', name: '荒古雷鸣' } },
  { name: '荒古：均衡', fx: { dmgUp: 0.19, elemAll: 26, crit: 0.04, mcrit: 0.04 } },
], '荒古戒指，属性与触发效果高于同等级普通史诗。');
defineAntonFusionSet('set_anton_mana', '魔能融合', 'support', [
  { name: '魔能：追击', fx: { dmgUp: 0.17, allStat: 34, aspd: 0.05 }, proc: { on: 'skill', chance: 0.11, cd: 1.4, act: 'strike', mul: 2.2, aoe: 110, vis: 'slash', name: '魔能追击' } },
  { name: '魔能：护幕', fx: { dmgUp: 0.16, allStat: 38, dmgReduce: 0.05 }, proc: { on: 'hurt', chance: 0.18, cd: 10, act: 'shield', amt: 0.15, dur: 5, name: '魔能护幕' } },
  { name: '魔能：灌注', fx: { dmgUp: 0.18, allStat: 30, cdr: 0.07 } },
  { name: '魔能：终局', fx: { dmgUp: 0.19, allStat: 44, critDmg: 0.1 }, proc: { on: 'kill', act: 'buff', buff: { dmg: 0.05 }, dur: 8, stack: 3, key: 'anton_finisher', name: '魔能终局' } },
], '魔能融合辅助装备，提供全属性和更高的触发上限。');
