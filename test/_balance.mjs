// 新旧属性公式对比：同等级、同品级的一身装备，新 recalcStats 与旧公式的 攻击 / 防御 / HP 比值
import { launch, URL_BASE } from './lib.mjs';
const { browser, page, logs } = await launch({ width: 800, height: 450 });
const rows = [];
for (const cls of ['sword', 'gun', 'mage']) {
  await page.goto(`${URL_BASE}?town&fresh&cls=${cls}&mute`);
  await page.waitForFunction(() => window.__READY && game.player && game.scene === 'town', null, { timeout: 20000 });
  rows.push(...await page.evaluate((cls) => {
    const out = [], p = game.player, C = CLASSES[cls];
    for (const L of [1, 5, 10, 15, 20, 25]) for (const r of [0, 1, 2]) {
      const T = TIER_LV.filter(t => t <= L && (r < 2 || t >= 5)).pop(); if (!T) continue;
      game.lvl = L; inv.equip = {};
      const w = CLASS_START_WEAPON[cls], m = masteryOf(cls, null);
      inv.equip.weapon = makeItem(`${w}_${T}_${r}`, 1, { grade: 2 });
      for (const s of ARMOR_SLOTS) inv.equip[s] = makeItem(`${m}_${s}_${T}_${r}`, 1, { grade: 2 });
      for (const s of ACC_SLOTS) inv.equip[s] = makeItem(`${s}_${T}_${r}`, 1, { grade: 2 });
      inv._normEq = inv.equip;
      recalcStats(p);
      // 旧公式（同等级 T、同品级、中级品质）
      const M = RAR_MUL[r], HB = HERO_BONUS;
      const oAtkW = (60 + 26 * T) * M, oStr = 3 * (2 + T * 0.9) * M, oBr = (8 + 5 * T) * M, oDef = 5 * (14 + 7 * T) * M, oHp = (20 + 12 * T) * M * 5.4;
      const str = C.str0 + C.strPer * (L - 1) + oStr;
      const oAtk = (C.atk0 + C.atkPer * (L - 1) + oAtkW + oBr) * (1 + str * 0.004) * HB.atk;
      const oD = (C.def0 + C.defPer * (L - 1) + oDef) * HB.def, oH = (C.hp0 + C.hpPer * (L - 1) + oHp) * HB.hp;
      const main = C.dmgType === 'mag' || cls === 'mage' ? p.matk : p.baseStats.atk;
      out.push({ cls, L, r, atk: +(main / oAtk).toFixed(3), def: +(p.def / oD).toFixed(3), hp: +(p.hpMax / oH).toFixed(3), newAtk: Math.round(main), oldAtk: Math.round(oAtk), mdef: Math.round(p.mdef) });
    }
    return out;
  }, cls));
}
console.table(rows);
console.log('LOGS', JSON.stringify(logs));
await browser.close();
