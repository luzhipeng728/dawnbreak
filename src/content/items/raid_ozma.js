/* =====================================================================
   奥兹玛攻坚战奖励（docs/RAID_OZMA.md §8）：货币「混沌的怨念」+ 融合装备 5 系列（毁灭 / 绝望 / 恐怖 / 牺牲 / 神焰），每系列一个部位、5 个可选词条 = 25 件。
   - 写法和数值预算沿用希洛克（raid_siroco.js / RAID_PLAN §4.3）：单件约为同部位 T3 的 35%；奥兹玛 Lv65，比希洛克 Lv63 高一档（dmgUp +0.03 左右）。
   - 部位用不挑护甲类型的饰品 / 特殊栏：毁灭 = 项链、绝望 = 手镯、恐怖 = 魔法石、牺牲 = 戒指、神焰 = 辅助装备【原创：官方融合部位未核实】。
   - key 规则 `raid_oz_<系列>_<1..5>`；规则核心的奖励表（raid_ozma.js 的 rewards.p2）直接写这 25 个 key（服务端看不到本文件）。
   - 图标：美术到位前借用希洛克融合装备同部位的图标（icon 字段），docs/RAID_ART_MANIFEST.json 登记后改成自己的 item_<key>。
   ===================================================================== */
const OZMA_RAID_GEAR = [];
const OZMA_SERIES_KEYS = ['ruin', 'despair', 'terror', 'sacrifice', 'flame'];
const OZMA_SET_ICONS = { ruin: 'item_raid_oz_destruction', despair: 'item_raid_oz_despair', terror: 'item_raid_oz_horror', sacrifice: 'item_raid_oz_sacrifice', flame: 'item_raid_oz_godflame' };
function defineOzmaFusionSet(sid, name, slot, iconFrom, options, desc) {
  const id = 'set_ozma_' + sid;
  defineSet(id, { name, epic: true, fusion: true, bonus: { 1: { st: { dmgUp: 0.09 }, desc: '融合装备伤害增加 9%，略高于希洛克融合装备。' } } });
  for (const [i, o] of options.entries()) {
    const key = `raid_oz_${sid}_${i + 1}`;
    const defIcon = OZMA_SET_ICONS[sid] || `item_raid_si_${iconFrom}_${i + 1}`;
    defineGear(key, { rar: 5, tier: 4, lvl: 65, slot, name: o.name, icon: typeof ASSET_SRC === 'undefined' || ASSET_SRC['icon/item_' + key] ? 'item_' + key : defIcon,
      fx: o.fx, proc: o.proc, set: id, desc: `${desc}${o.desc ? ` ${o.desc}` : ''}（奥兹玛独立融合装备）`, src: '奥兹玛攻坚战翻牌、混沌的怨念兑换' });
    SETS[id].pieces.push(key); OZMA_RAID_GEAR.push(key);
  }
}
defineItem('raid_ozma_grudge', { kind: 'mat', name: '混沌的怨念', rar: 4, price: 1500, sellMul: 0.05, col: '#ff6a8a', icon: 'item_raid_oz_chaos', noSell: true, desc: '奥兹玛攻坚战的混沌残渣。混沌等级越高，翻牌得到的越多，可在攻坚商店兑换奥兹玛融合装备。' });

defineOzmaFusionSet('ruin', '毁灭融合', 'neck', 'immateriality', [
  { name: '毁灭：灰烬', fx: { dmgUp: 0.22, str: 78, int: 78, cdr: 0.03 }, desc: '技能命中后 3 秒内伤害额外 +8%。' },
  { name: '毁灭：裂隙', fx: { dmgUp: 0.21, cdr: 0.09, elemAll: 26 } },
  { name: '毁灭：黑焰', fx: { dmgUp: 0.23, fire: 46, critDmg: 0.11 }, proc: { on: 'skill', chance: 0.12, cd: 1.8, act: 'strike', mul: 3, elem: 'fire', vis: 'fire', name: '毁灭黑焰' } },
  { name: '毁灭：锐锋', fx: { dmgUp: 0.21, crit: 0.07, mcrit: 0.07, cdr: 0.05 } },
  { name: '毁灭：终焉', fx: { dmgUp: 0.25, allStat: 50, hpPct: 0.08 } },
], '毁灭区域的融合项链，基础伤害与等级均高于希洛克融合装备。');
defineOzmaFusionSet('despair', '绝望融合', 'bracelet', 'subconscious', [
  { name: '绝望：叹息', fx: { dmgUp: 0.22, dark: 46, aspd: 0.06, cdr: 0.03 }, proc: { on: 'skill', chance: 0.1, cd: 1.8, act: 'strike', mul: 2.7, elem: 'dark', vis: 'dark', name: '绝望叹息' } },
  { name: '绝望：幽蓝', fx: { dmgUp: 0.22, ice: 46, cspd: 0.06, cdr: 0.03 } },
  { name: '绝望：枯萎', fx: { dmgUp: 0.21, dark: 40, critDmg: 0.1 }, proc: { on: 'crit', chance: 0.12, cd: 1.2, act: 'strike', mul: 3, elem: 'dark', vis: 'dark', name: '枯萎之触' } },
  { name: '绝望：回响', fx: { dmgUp: 0.21, elemAll: 28, mspd: 0.07, cdr: 0.04 } },
  { name: '绝望：深渊', fx: { dmgUp: 0.24, allStat: 46, dmgReduce: 0.04 } },
], '绝望区域的融合手镯，属性与触发效果高于同等级普通史诗。');
defineOzmaFusionSet('terror', '恐怖融合', 'stone', 'phantasm', [
  { name: '恐怖：震地', fx: { dmgUp: 0.22, str: 70, int: 70, aspd: 0.05 }, proc: { on: 'skill', chance: 0.11, cd: 1.4, act: 'strike', mul: 2.6, aoe: 130, vis: 'slash', name: '恐怖震地' } },
  { name: '恐怖：岩肤', fx: { dmgUp: 0.21, allStat: 46, dmgReduce: 0.07 }, proc: { on: 'hurt', chance: 0.18, cd: 10, act: 'shield', amt: 0.18, dur: 5, name: '岩肤护幕' } },
  { name: '恐怖：凝视', fx: { dmgUp: 0.23, allStat: 38, cdr: 0.08 } },
  { name: '恐怖：熔核', fx: { dmgUp: 0.22, fire: 44, critDmg: 0.1, hpPct: 0.06 } },
  { name: '恐怖：掠食', fx: { dmgUp: 0.24, crit: 0.07, aspd: 0.06, mspd: 0.05 } },
], '恐怖区域的融合魔法石，提供更高的触发上限。');
defineOzmaFusionSet('sacrifice', '牺牲融合', 'ring', 'subconscious', [
  { name: '牺牲：誓约', fx: { dmgUp: 0.22, allStat: 44, hpPct: 0.1 }, desc: '殉道者的誓约，以生命换取力量。' },
  { name: '牺牲：献祭', fx: { dmgUp: 0.24, critDmg: 0.14, hpPct: -0.05 } },
  { name: '牺牲：赎罪', fx: { dmgUp: 0.21, cdr: 0.08, dmgReduce: 0.06 }, proc: { on: 'hurt', chance: 0.16, cd: 12, act: 'shield', amt: 0.2, dur: 5, name: '赎罪之盾' } },
  { name: '牺牲：血契', fx: { dmgUp: 0.23, crit: 0.08, aspd: 0.05 } },
  { name: '牺牲：殉道', fx: { dmgUp: 0.22, elemAll: 30, str: 60, int: 60 }, proc: { on: 'skill', chance: 0.1, cd: 2, act: 'strike', mul: 2.8, elem: 'light', vis: 'holy', name: '殉道圣光' } },
], '殉道者礼拜堂的融合戒指，用代价换取更高的输出。');
defineOzmaFusionSet('flame', '神焰融合', 'support', 'phantasm', [
  { name: '神焰：余烬', fx: { dmgUp: 0.22, fire: 48, aspd: 0.05 }, proc: { on: 'skill', chance: 0.11, cd: 1.6, act: 'strike', mul: 2.7, aoe: 120, elem: 'fire', vis: 'fire', name: '神焰余烬' } },
  { name: '神焰：炽盾', fx: { dmgUp: 0.21, allStat: 46, dmgReduce: 0.06 }, proc: { on: 'hurt', chance: 0.18, cd: 10, act: 'shield', amt: 0.17, dur: 5, name: '炽焰护幕' } },
  { name: '神焰：燎原', fx: { dmgUp: 0.24, fire: 40, critDmg: 0.1 } },
  { name: '神焰：明光', fx: { dmgUp: 0.22, light: 44, cdr: 0.08 } },
  { name: '神焰：不灭', fx: { dmgUp: 0.23, allStat: 48, hpPct: 0.1 } },
], '卡赞神焰凝成的融合辅助装备，提供全属性和触发效果。');
