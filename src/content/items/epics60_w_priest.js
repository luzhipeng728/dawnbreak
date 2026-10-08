/* =====================================================================
   圣职者（男）具名史诗武器（十字架 / 念珠 / 图腾 / 镰刀 / 战斧）
   ===================================================================== */
{
const PRIEST_EPIC_ICON = { cross: 'cross', rosary: 'item_w_rod', totem: 'item_w_club', scythe: 'item_w_spear', battleaxe: 'item_w_greatsword' };
const PRIEST_EPIC_NAME = { cross: '十字架', rosary: '念珠', totem: '图腾', scythe: '镰刀', battleaxe: '战斧' };
const PRIEST_EPIC_LEVELS = [8, 15, 22, 28, 35, 38, 45, 48, 52, 55, 58, 60];
const PRIEST_EPIC_DESC = {
  cross: '祈祷与守护之力凝在十字架的金属纹路里。',
  rosary: '每一颗念珠都记录着圣职者走过的战场。',
  totem: '沉重图腾的侧面刻着驱邪的古老符文。',
  scythe: '镰刃划过空气时留下幽暗而锋利的弧光。',
  battleaxe: '战斧的厚重刃口能把恶魔的护甲一并劈开。',
};
const priestEpicFx = (w, i) => {
  const mag = w === 'rosary' || w === 'scythe' || w === 'cross';
  const elem = ['light', 'dark', 'fire', 'ice'][i % 4];
  // 按装备 2.0 的档位预算：早期武器不能因为随机属性偏低而把 Lv30 基准压得过低，
  // Lv35~60 再逐步过渡到 T1/T2/T3 的伤害词条。
  const dmgBudget = [0.05, 0.07, 0.09, 0.12, 0.12, 0.12, 0.11, 0.12, 0.12, 0.125, 0.13, 0.14];
  const fx = { dmgUp: dmgBudget[i] ?? 0.1, [elem]: 8 + i * 2 };
  if (mag) Object.assign(fx, { mcrit: 0.02 + (i > 5 ? 0.01 : 0), cspd: 0.02 + (i > 7 ? 0.03 : 0), int: i > 7 ? 18 + i * 3 : 0 });
  else Object.assign(fx, { crit: 0.02 + (i > 5 ? 0.01 : 0), aspd: i > 7 ? 0.04 : 0, str: i > 7 ? 18 + i * 3 : 0 });
  // 物理 / 魔法武器分别给对应主属性，避免同一件装备把两套攻击口径叠加，
  // 同时让 Lv52~60 的 T1/T2/T3 预算和其他职业保持一致。
  const magical = w === 'cross' || w === 'rosary';
  if (i >= 4) {
    if (magical) Object.assign(fx, { mcrit: fx.mcrit || 0.02, cspd: fx.cspd || 0.02, int: 14 + i * 2 });
    else Object.assign(fx, { crit: fx.crit || 0.02, aspd: fx.aspd || 0.02, str: 14 + i * 2 });
  }
  // 圣职者巨兵可由四个转职通用装备；物理向武器也保留魔法暴击，
  // 魔法向武器也保留物理暴击，避免转职拿到完全无效的词条。
  if (magical) fx.crit = fx.crit || 0.02;
  else fx.mcrit = fx.mcrit || 0.02;
  if (i >= 8) fx.critDmg = 0.04 + (i - 8) * 0.015;
  return fx;
};
const priestEpicPal = (w, i) => {
  const base = { cross: ['#e8eefc', '#7b8fc4', '#c9dcff'], rosary: ['#f0d58a', '#8f5f32', '#ffe7a6'], totem: ['#7b4c2e', '#d8a65a', '#ffcf72'], scythe: ['#40365e', '#9b6fd0', '#d5b7ff'], battleaxe: ['#5b6475', '#c17b45', '#ffd08a'] }[w];
  const vary = (hex, n) => {
    const v = parseInt(hex.slice(1), 16), r = v >> 16 & 255, g = v >> 8 & 255, b = v & 255;
    return '#' + [r, g, (b & 240) | (n & 15)].map(x => x.toString(16).padStart(2, '0')).join('');
  };
  return { main: vary(base[0], i), trim: vary(base[1], i), glow: vary(base[2], i) };
};
const priestEpicSeed = (w, i) => `priest_${w}_${i}`;
const priestCalmSeed = (w, i, def) => {
  const key = `priest_${w}_${i}`;
  for (let n = 0; n < 60; n++) {
    const seed = n ? `${key}#${n}` : key;
    const st = gearStats({ kind: 'equip', rar: 5, ...def, seed }, mulberry(keySeed(seed)));
    if (!st.str && !st.int && !st.crit && !st.hp && !st.vit) return seed;
  }
  return key;
};
const priestEpic = (w, i, lvl) => {
  const key = `ep_${PRIEST_IDS.weapons[w]}_${['dawn', 'vow', 'halo', 'ward', 'night', 'scripture', 'judgement', 'sanctum', 'oracle', 'inheritance', 'covenant', 'cathedral'][i]}`;
  const tier = lvl === 52 ? 1 : lvl === 55 ? 2 : lvl === 58 ? 3 : undefined;
  const def = { rar: 5, slot: 'weapon', wtype: w, lvl, tier, icon: PRIEST_EPIC_ICON[w], ...(i ? { pal: priestEpicPal(w, i) } : {}), name: `${PRIEST_EPIC_NAME[w]}·${['晨祷', '誓约', '圣辉', '镇魂', '暗夜', '经文', '审判', '圣域', '神谕', '传承', '盟约', '大圣堂'][i]}`, fx: priestEpicFx(w, i), desc: `${PRIEST_EPIC_DESC[w]}（男圣职者 Lv${lvl} 史诗）`, src: '地下城掉落、深渊派对' };
  const seed = priestCalmSeed(w, i, def), raw = gearStats({ kind: 'equip', ...def, seed }, mulberry(keySeed(seed)));
  if (i >= 4 && (w === 'cross' || w === 'scythe')) {
    const scale = w === 'cross' ? 0.85 : 0.8;
    for (const k of ['atk', 'matk', 'indep']) if (raw[k]) raw[k] = Math.round(raw[k] * scale);
    def.fx = { ...def.fx, dmgUp: +((def.fx.dmgUp || 0) * scale).toFixed(3) };
  }
  defineGear(key, { ...def, seed, st: raw, stOnly: true });
  return key;
};
const PRIEST_EPICS = Object.fromEntries(Object.keys(PRIEST_IDS.weapons).map(w => [w, PRIEST_EPIC_LEVELS.map((lvl, i) => priestEpic(w, i, lvl))]));
const PRIEST_ALL_EPICS = Object.values(PRIEST_EPICS).flat();
const PRIEST_NAMED = ['cr', 'ro', 'tt', 'sc', 'ba', 'cr'].map((code, i) => defineNamed(`nm_priest_${i + 1}`, { slot: 'weapon', wtype: Object.keys(PRIEST_IDS.weapons).find(w => PRIEST_IDS.weapons[w] === code), lvl: 34 + i * 4, name: `圣职者神器·${['圣言', '念珠王', '镇岳', '断罪', '破魔', '裁决'][i]}`, icon: PRIEST_EPIC_ICON[Object.keys(PRIEST_IDS.weapons).find(w => PRIEST_IDS.weapons[w] === code)], fx: { dmgUp: 0.08, allStat: 18 + i * 4 }, desc: '只在对应区域领主处掉落的男圣职者专属神器。' }));
abyssClaim('sky_castle', PRIEST_ALL_EPICS.filter(k => ITEMS[k].lvl >= 21 && ITEMS[k].lvl <= 30));
abyssClaim('darkelf', PRIEST_ALL_EPICS.filter(k => ITEMS[k].lvl === 38 || ITEMS[k].lvl === 35).slice(0, 10));
abyssClaim('timegate', PRIEST_ALL_EPICS.filter(k => ITEMS[k].lvl >= 52).slice(0, 10));
for (const [i, code] of PRIEST_NAMED.entries()) monDrop(['skeleton','skasa','kain','siroco','ozma','apep'][i], [[code.key, 0.02]]);
}
