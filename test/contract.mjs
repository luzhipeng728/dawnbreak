// Conqueror's Contract：项目自定义的 PvE 装备等级便利（账号范围、+10、竞技场排除、到期卸下）。
import { launch, URL_BASE } from './lib.mjs';
const { browser, page, logs } = await launch({ width: 900, height: 500 });
let fail = 0;
const check = (v, msg, x = '') => { console.log(v ? '  ✓' : '  ✗', msg, x ? JSON.stringify(x) : ''); if (!v) fail++; };
await page.goto(`${URL_BASE}?town&mute&fresh&cls=sword`);
await page.waitForFunction(() => window.__READY && game.player && game.scene === 'town', null, { timeout: 30000 });
const r = await page.evaluate(() => {
  window.toastMsg = () => {};
  game.lvl = 20; game.scene = 'town'; game.pvp = false; game.duel = null;
  save.acct = {};
  const D = GEAR.find(x => x.kind === 'equip' && x.slot === 'weapon' && x.lvl === 30 && (!x.cls || x.cls === 'sword'));
  const it = D && makeItem(D.key);
  const before = inv.canWear(it, true);
  const now = Date.now();
  const until = activateConquerorContract(1, now);
  const during = inv.canWear(it, true);
  game.pvp = true;
  const arena = inv.canWear(it, true);
  game.pvp = false;
  const cap = equipLevelCap(20, 'town');
  inv.items.push(it); inv.wear(it);
  const equipped = inv.equip.weapon === it;
  save.acct.contracts.conquerorUntil = 1;
  save.acct.membership.conquerorUntil = 1;
  save.acct.conquerorUntil = 1;
  const moved = expireOverlevelEquipment();
  const vipUntilAt = activateVip(1, now), vipCap = equipLevelCap(20, 'town'), vipFatigue = fatigueMax();
  return { key: D && D.key, before, until, during, arena, equipped, moved, still: inv.items.includes(it), cap, duelCap: equipLevelCap(20, 'duel'), vipUntilAt, vipCap, vipFatigue };
});
check(r.before === false, '无契约时不能穿戴高 10 级装备', r);
check(r.until > 1000000 && r.during === true, '契约激活后允许角色等级 +10 内装备', r);
check(r.arena === false && r.duelCap === 20, '竞技场排除契约上限', r);
check(r.equipped && r.moved === 1 && r.still, '契约到期自动卸下但不丢失装备', r);
check(r.cap === 30, 'PvE 契约上限为角色等级 +10', r);
check(r.vipUntilAt > Date.now() && r.vipCap === 20 && r.vipFatigue === 188, 'VIP 独立于 Conqueror 契约（不提高装备上限，仅增加疲劳上限）', r);
const contractPurchase = await page.evaluate(() => {
  const now = Date.now();
  save.acct = { cera: 50000, membership: {}, contracts: {} };
  save.chars = [save.defaults('sword', '一号角色'), save.defaults('mage', '二号角色')];
  save.cur = 0; save.data = save.chars[0]; save.live = true;
  const C7 = ITEMS.contract_conqueror_7, C15 = ITEMS.contract_conqueror_15, V7 = ITEMS.contract_vip_7;
  const defs = {
    c7: C7 && { bind: itemBind({ key: 'contract_conqueror_7' }), tradable: itemTradable({ key: 'contract_conqueror_7' }), sellable: canSell({ key: 'contract_conqueror_7', kind: 'use' }) },
    c15: C15 && { bind: itemBind({ key: 'contract_conqueror_15' }), tradable: itemTradable({ key: 'contract_conqueror_15' }) },
    vip: V7 && { bind: itemBind({ key: 'contract_vip_7' }), tradable: itemTradable({ key: 'contract_vip_7' }) },
  };
  const cera0 = cashBal('cera');
  const buyC = cashBuy('contract_conqueror_7', 1);
  const afterC = { cera: cashBal('cera'), active: conquerorActive(now), cap: equipLevelCap(20, 'town'), arena: equipLevelCap(20, 'arena'), inv: inv.count('contract_conqueror_7') };
  save.write();
  const persisted = JSON.parse(localStorage.getItem(save.key) || '{}');
  const acctShared = !!(persisted.acct && persisted.acct.contracts && persisted.acct.contracts.conquerorUntil > now && persisted.acct.membership && persisted.acct.membership.conquerorUntil > now);
  save.select(1); save.apply();
  const secondCharacter = conquerorActive(now) && equipLevelCap(20, 'town') === 30;
  save.select(0); save.apply();
  const oldGear = GEAR.find(x => x.kind === 'equip' && x.slot === 'weapon' && x.lvl === 30 && (!x.cls || x.cls === 'mage')) || GEAR.find(x => x.kind === 'equip' && x.slot === 'weapon' && x.lvl === 30);
  const oldIt = oldGear && makeItem(oldGear.key);
  save.chars[1].lvl = 20; save.chars[1].equip = { weapon: oldIt }; save.chars[1].inv = [];
  save.acct.contracts.conquerorUntil = now - 1; save.acct.membership.conquerorUntil = now - 1; save.acct.conquerorUntil = now - 1;
  const expiredAll = expireOverlevelEquipmentAll();
  const otherMoved = save.chars[1].equip.weapon == null && save.chars[1].inv.includes(oldIt);
  const buyV = cashBuy('contract_vip_7', 1);
  return { defs, cera0, buyC, afterC, acctShared, secondCharacter, expiredAll, otherMoved, buyV, vip: vipActive(now), fatigue: fatigueMax(), invVip: inv.count('contract_vip_7') };
});
check(contractPurchase.defs.c7 && contractPurchase.defs.c7.bind === 'account' && contractPurchase.defs.c7.tradable === false && contractPurchase.defs.c7.sellable === false, '商城契约定义为账号绑定且不可交易/出售', contractPurchase);
check(contractPurchase.defs.c15 && contractPurchase.defs.c15.bind === 'account' && contractPurchase.defs.c15.tradable === false, '15 天 Conqueror 契约同样账号绑定', contractPurchase);
check(contractPurchase.defs.vip && contractPurchase.defs.vip.bind === 'account' && contractPurchase.defs.vip.tradable === false, 'VIP 契约与 Conqueror 分开且账号绑定', contractPurchase);
check(contractPurchase.buyC && contractPurchase.buyC.ok && contractPurchase.buyC.activated && contractPurchase.afterC.cera < contractPurchase.cera0 && contractPurchase.afterC.active && contractPurchase.afterC.inv === 0, '商城购买 7 天 Conqueror 后立即生效且不把契约当普通背包物品', contractPurchase);
check(contractPurchase.afterC.cap === 30 && contractPurchase.afterC.arena === 20, '商城开通仍是 PvE +10、Arena 排除', contractPurchase);
check(contractPurchase.acctShared && contractPurchase.secondCharacter, '契约写入账号存档并对第二角色立即生效', contractPurchase);
check(contractPurchase.expiredAll >= 1 && contractPurchase.otherMoved, '契约到期时其他角色的超等级装备也卸下但保留在该角色背包', contractPurchase);
check(contractPurchase.buyV && contractPurchase.buyV.ok && contractPurchase.buyV.activated && contractPurchase.vip && contractPurchase.fatigue === 188 && contractPurchase.invVip === 0, 'VIP 独立购买、立即生效、只提高疲劳上限', contractPurchase);
check(await page.evaluate(() => { menus.open('cash', { tab: 'contract' }); const t = [...document.querySelectorAll('[data-win=cash]')].map(x => x.textContent).join(' '); return t.includes('征服者契约') && t.includes('VIP高级契约'); }), '商城契约页有独立的 VIP / 征服者契约入口');
check(await page.evaluate(() => ['contract_conqueror_7', 'contract_conqueror_15', 'contract_vip_7'].every(k => ITEMS[k] && ITEMS[k].cashIcon === k && (ASSET_SRC['cash/' + k] || IMG['cash/' + k]))), '三种契约使用专用商城图标');
check(!logs.some(x => x.type === 'pageerror'), '没有页面错误', logs.filter(x => x.type === 'pageerror').slice(0, 2));
await browser.close();
console.log(fail ? `✗ ${fail} 项失败` : '全部通过');
process.exit(fail ? 1 : 0);
