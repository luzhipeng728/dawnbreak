// 契约 / VIP 规则单测（不开浏览器）：在 Node VM 里跑 src/game/save.js，验证账号级契约、到期、等级上限与过级装备失效
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// Contract rules are kept in save.js's browser scope. Run the same functions in a
// small Node VM so account scope and expiry can be checked without a GUI browser.
const source = fs.readFileSync(new URL('../src/game/save.js', import.meta.url), 'utf8') + `
this.__contractApi = { save, activateVip, activateConquerorContract, conquerorActive,
  conquerorUntil, vipActive, fatigueMax, equipLevelCap, expireOverlevelEquipmentAll,
  contractStatus };
`;
const stored = new Map();
const ctx = {
  PARAMS: new Set(), SKILL_SLOTS: 14, CLASSES: {},
  game: { lvl: 20, scene: 'town', pvp: false, duel: null, player: null },
  inv: { items: [], equip: {} },
  bus: { on() {} }, clsOpen: () => true,
  addEventListener() {}, document: { addEventListener() {} },
  localStorage: { getItem: k => stored.get(k) || null, setItem: (k, v) => stored.set(k, v) },
  cloudSave: { changed() {} }, toastMsg() {}, questsDailyReset() {},
  spMigrate() {},
};
vm.runInNewContext(source, ctx, { filename: 'src/game/save.js' });
const A = ctx.__contractApi;
const now = Date.now();

A.save.acct = { cera: 50000, membership: {}, contracts: {} };
A.save.data = A.save.defaults('sword', '测试角色');
A.save.chars = [A.save.data, A.save.defaults('mage', '第二角色')];
A.save.cur = 0; A.save.live = true;

assert.equal(A.equipLevelCap(20, 'town'), 20, 'inactive contract keeps base PvE cap');
const seven = A.activateConquerorContract(7, now);
assert.ok(seven > now + 6 * 86400000, 'Conqueror activation grants seven days');
assert.equal(A.equipLevelCap(20, 'town'), 30, 'Conqueror grants current level +10 in PvE');
assert.equal(A.equipLevelCap(20, 'arena'), 20, 'Arena excludes Conqueror equipment bonus');
assert.equal(A.equipLevelCap(20, 'duel'), 20, 'Duel excludes Conqueror equipment bonus');
assert.equal(A.contractStatus(now).conquerorActive, true, 'status reports active Conqueror contract');
assert.ok(stored.size && JSON.parse(stored.get(A.save.key)).acct.membership.conquerorUntil > now, 'activation persists account membership');

const fifteen = A.activateConquerorContract(15, now);
assert.ok(fifteen > seven, 'renewing a contract extends the later expiry');
const vip = A.activateVip(7, now);
assert.ok(vip > now + 6 * 86400000 && A.vipActive(now), 'VIP has an independent expiry');
assert.equal(A.equipLevelCap(20, 'town'), 30, 'VIP does not replace Conqueror cap');
assert.equal(A.fatigueMax(), 188, 'VIP affects fatigue independently');

// Expiry applies to every open account character and preserves equipment in that
// character's own inventory. The selected character is represented by ctx.inv.
const currentGear = { key: 'weapon_test', kind: 'equip', slot: 'weapon', lvl: 30 };
const otherGear = { key: 'armor_test', kind: 'equip', slot: 'top', lvl: 31 };
ctx.inv.items = []; ctx.inv.equip = { weapon: currentGear };
A.save.data.equip = ctx.inv.equip; A.save.data.inv = ctx.inv.items;
A.save.chars[1].lvl = 20; A.save.chars[1].equip = { top: otherGear }; A.save.chars[1].inv = [];
A.save.acct.membership.conquerorUntil = now - 1;
A.save.acct.contracts.conquerorUntil = now - 1;
A.save.acct.conquerorUntil = now - 1;
const moved = A.expireOverlevelEquipmentAll();
assert.equal(moved, 2, 'expiry reconciles selected and non-selected characters');
assert.equal(ctx.inv.equip.weapon, undefined, 'selected over-level item is unequipped');
assert.equal(ctx.inv.items.includes(currentGear), true, 'selected item is preserved in inventory');
assert.equal(A.save.chars[1].equip.top, undefined, 'other character over-level item is unequipped');
assert.equal(A.save.chars[1].inv.includes(otherGear), true, 'other character keeps item in its own inventory');

// A stale receipt timestamp still starts a fresh valid term from the wall clock.
A.save.acct.membership.conquerorUntil = 0;
A.save.acct.contracts.conquerorUntil = 0;
A.save.acct.conquerorUntil = 0;
const stale = A.activateConquerorContract(1, now - 10 * 86400000);
assert.ok(stale > Date.now(), 'stale activation input cannot create an already expired contract');

const itemSource = fs.readFileSync(new URL('../src/content/cash/items.js', import.meta.url), 'utf8');
const catalogSource = fs.readFileSync(new URL('../src/content/cash/catalog.js', import.meta.url), 'utf8');
for (const key of ['contract_conqueror_7', 'contract_conqueror_15', 'contract_vip_7']) {
  assert.match(itemSource, new RegExp(`defCashUse\\('${key}'`), `${key} has a usable item definition`);
  assert.match(itemSource, new RegExp(`defCashUse\\('${key}'[^\\n]*bind: 'account'`), `${key} is account bound`);
  assert.match(itemSource, new RegExp(`defCashUse\\('${key}'[^\\n]*cashUse: 'contract'`), `${key} activates as a contract`);
  assert.match(catalogSource, new RegExp(`defGoods\\('${key}'`), `${key} has a real cash-shop entry`);
}

console.log('契约规则 Node 单测通过：账号范围、+10、Arena 排除、VIP 分离、续期、过期全角色装备保留、商城/物品入口');
