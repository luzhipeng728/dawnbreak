/* 希洛克融合装备：独立于现有深渊 / 区域史诗，三类融合位各 5 个可选词条。 */
const SIROCO_RAID_GEAR = [];
function defineSirocoFusionSet(id, name, slot, options, desc) {
  defineSet(id, { name, epic: true, fusion: true, bonus: { 1: { st: { dmgUp: 0.08 }, desc: '融合装备伤害增加 8%，高于现有 Lv60 史诗套装的单部位收益。' } } });
  for (const [i, o] of options.entries()) { const key = `raid_si_${id.replace('set_siroco_', '')}_${i + 1}`;
    defineGear(key, { rar: 5, tier: 4, lvl: 63, slot, ...(slot === 'bottom' ? { atype: 'light' } : {}), name: o.name, icon: 'item_' + key, fx: o.fx, proc: o.proc, set: id, desc: `${desc}${o.desc ? ` ${o.desc}` : ''}（希洛克独立融合装备）`, src: '希洛克攻坚战翻牌、无形之息兑换' });
    SETS[id].pieces.push(key); SIROCO_RAID_GEAR.push(key);
  }
}
defineSirocoFusionSet('set_siroco_immateriality', '无意识融合', 'bottom', [
  { name: '无意识：寂静', fx: { dmgUp: 0.19, str: 72, int: 72, cdr: 0.03 }, desc: '技能命中后 3 秒内伤害额外 +8%。' }, { name: '无意识：回响', fx: { dmgUp: 0.18, cdr: 0.09, elemAll: 24 } }, { name: '无意识：侵蚀', fx: { dmgUp: 0.2, dark: 42, critDmg: 0.1 }, proc: { on: 'skill', chance: 0.12, cd: 1.8, act: 'strike', mul: 2.8, elem: 'dark', vis: 'dark', name: '意识侵蚀' } }, { name: '无意识：镜界', fx: { dmgUp: 0.18, crit: 0.06, mcrit: 0.06, cdr: 0.05 } }, { name: '无意识：终焉', fx: { dmgUp: 0.22, allStat: 46, hpPct: 0.08 }, proc: { on: 'lowhp', cd: 40, act: 'buff', buff: { dmg: 0.24 }, dur: 8, key: 'siroco_end', name: '终焉回响' } },
], '无意识之棺的融合下装，基础伤害与等级均超过现有 Lv60 史诗。');
defineSirocoFusionSet('set_siroco_subconscious', '潜意识融合', 'ring', [
  { name: '潜意识：光', fx: { dmgUp: 0.19, light: 42, aspd: 0.06, cdr: 0.03 }, proc: { on: 'skill', chance: 0.1, cd: 1.8, act: 'strike', mul: 2.5, elem: 'light', vis: 'holy', name: '潜意识之光' } }, { name: '潜意识：暗', fx: { dmgUp: 0.19, dark: 42, cspd: 0.06, cdr: 0.03 } }, { name: '潜意识：火', fx: { dmgUp: 0.19, fire: 42, critDmg: 0.09 }, proc: { on: 'crit', chance: 0.12, cd: 1.2, act: 'strike', mul: 2.8, elem: 'fire', vis: 'fire', name: '潜意识之火' } }, { name: '潜意识：冰', fx: { dmgUp: 0.18, ice: 42, mspd: 0.07, cdr: 0.06 } }, { name: '潜意识：均衡', fx: { dmgUp: 0.21, elemAll: 28, crit: 0.04, mcrit: 0.04 } },
], '潜意识之厅的融合戒指，属性与触发效果高于同等级普通史诗。');
defineSirocoFusionSet('set_siroco_phantasm', '幻影融合', 'support', [
  { name: '幻影：追击', fx: { dmgUp: 0.19, allStat: 38, aspd: 0.05 }, proc: { on: 'skill', chance: 0.11, cd: 1.4, act: 'strike', mul: 2.4, aoe: 120, vis: 'slash', name: '幻影追击' } }, { name: '幻影：护幕', fx: { dmgUp: 0.18, allStat: 42, dmgReduce: 0.06 }, proc: { on: 'hurt', chance: 0.18, cd: 10, act: 'shield', amt: 0.16, dur: 5, name: '幻影护幕' } }, { name: '幻影：凝视', fx: { dmgUp: 0.2, allStat: 34, cdr: 0.08 } }, { name: '幻影：回生', fx: { dmgUp: 0.18, allStat: 46, hpPct: 0.1 }, proc: { on: 'lowhp', cd: 42, act: 'heal', hp: 0.24, name: '幻影回生' } }, { name: '幻影：终局', fx: { dmgUp: 0.22, allStat: 52, critDmg: 0.12 }, proc: { on: 'kill', act: 'buff', buff: { dmg: 0.06 }, dur: 8, stack: 3, key: 'siroco_finisher', name: '幻影终局' } },
], '意识之厅的融合辅助装备，提供全属性和更高的触发上限。');
