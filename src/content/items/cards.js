/* =====================================================================
   物品库 · 怪物卡片（附魔用，官方经典做法：卡片由怪物 / 领主掉落，每张卡限定可附魔的部位）
   格式和商城组的宝珠一样：defineItem(key, { kind: 'mat', orb: { on: [部位 / 分组], st } })，附魔规则见 game/gear.js
   掉落：CARD_DROPS[怪物 kind] = 卡片 key；普通怪 0.3%、精英 2%、领主 6%（深渊派对里翻倍），在 content/abyss.js 的 abyssExtraDrops 里掷
   ===================================================================== */
const CARD_DROPS = {};
function defineCard(kind, def) {
  const key = 'card_' + kind, on = def.on;
  defineItem(key, { kind: 'mat', rar: def.rar, price: [400, 1200, 3000, 8000, 20000][def.rar] || 1000, sellMul: 0.2, col: '#9ae8ff', icon: 'item_card' + Math.min(4, Math.max(1, def.rar)),
    name: def.name, orb: { on, st: def.st }, src: def.src || `${def.mon || ''}掉落`, desc: `怪物卡片：可以附魔到${orbOnText(on)}。${def.desc || ''}` });
  (def.kinds || [kind]).forEach(k => { CARD_DROPS[k] = key; });
  return key;
}
{
// 怪物名（天空之城的怪物在物品库之后才注册，所以这里写死一份）
const MON_NAME = { goblin: '哥布林', goblinThrower: '投掷哥布林', goblinCaptain: '哥布林十夫长', tauSoldier: '牛头兵', catDemon: '猫妖', catGlow: '荧光猫妖', goblinFrost: '冰霜哥布林', goblinRed: '赤哥布林', catVenom: '毒爪猫妖',
  zombie: '饥饿僵尸', tauBeast: '牛头巨兽', goblinChief: '投掷哥布林首领', tauSoldierBoss: '牛头兵首领', catCurse: '暗咒猫妖', goblinShaman: '落雷 凯诺', catKing: '毒猫王', frostMage: '冰霜 克拉赫', flameMage: '烈焰 彼诺修',
  tauKing: '牛头王 萨乌塔', zombieRed: '卡尔扎克', boneLord: '盗尸者 骨狱息', wyvern: '翼龙', dragonman: '龙人', minius: '米尼乌斯', puppeteer: '人偶师', golem: '石巨人', kargo: '卡格', expeller: '驱逐者', knight: '侍剑骑兵',
  lucas: '鲁卡斯', dogrey: '人偶之王 道格里', platani: '黄金巨人 普拉塔尼', skyExpeller: '天之驱逐者', seghart: '光之城主 赛格哈特', sinEye: '罪恶之眼' };
const monName = k => MON_NAME[k] || (MON[k] || {}).name || k;
const C = (kind, rar, on, st, extra = {}) => defineCard(kind, { rar, on, st, name: `${monName(kind).split(' ').pop()}卡片`, mon: monName(kind), ...extra });
/* ---- 格兰之森 ---- */
C('goblin', 1, ['shoes'], { mspd: 0.02 }, { kinds: ['goblin', 'goblinCoward'] });
C('goblinThrower', 1, ['ring'], { hit: 0.02 });
C('goblinCaptain', 1, ['belt'], { hardness: 12 });
C('tauSoldier', 1, ['top', 'bottom'], { hp: 150 }, { kinds: ['tauSoldier', 'tauVanguard', 'tauGuard'] });
C('catDemon', 1, ['head'], { aspd: 0.015, cspd: 0.015 });
C('catGlow', 2, ['neck'], { light: 8 });
C('goblinFrost', 2, ['neck', 'bracelet'], { ice: 8 });
C('goblinRed', 2, ['bracelet'], { fire: 8 }, { kinds: ['goblinRed', 'goblinBomber'] });
C('catVenom', 2, ['ring'], { dark: 8 });
C('zombie', 2, ['belt'], { vit: 12, spr: 12 }, { kinds: ['zombie', 'plague'] });
C('tauBeast', 2, ['top', 'bottom'], { hp: 280, def: 60 });
C('goblinChief', 2, ['title'], { str: 8, int: 8 });
C('tauSoldierBoss', 2, ['support'], { str: 6, int: 6, vit: 6, spr: 6 });
C('catCurse', 2, ['shoes'], { evade: 0.02, mspd: 0.02 });
C('goblinShaman', 3, ['stone'], { elemAll: 8 });
C('catKing', 3, ['head'], { crit: 0.02, mcrit: 0.02 });
C('frostMage', 3, ['neck', 'bracelet', 'ring'], { ice: 12 });
C('flameMage', 3, ['neck', 'bracelet', 'ring'], { fire: 12 });
C('tauKing', 3, ['weapon', 'top', 'bottom'], { atk: 35, matk: 35, indep: 35 }, { desc: '（官方：虫王戮蛊卡片，武器 / 上衣 / 下装物攻 +20）' });
C('zombieRed', 3, ['belt', 'shoes'], { hardness: 20, hp: 150 });
C('boneLord', 4, ['title'], { str: 15, int: 15, vit: 15, spr: 15 });
/* ---- 天空之城 ---- */
C('wyvern', 1, ['shoes'], { mspd: 0.03 }, { kinds: ['wyvern', 'wyvernBlue'] });
C('dragonman', 2, ['top', 'bottom'], { hp: 320 });
C('minius', 2, ['head'], { crit: 0.015, mcrit: 0.015 });
C('puppeteer', 2, ['ring'], { dark: 10 }, { kinds: ['puppeteer', 'puppeteerRock', 'puppeteerIce'] });
C('golem', 2, ['title'], { hardness: 20 }, { kinds: ['golem', 'golemBronze', 'golemMaster'], desc: '（官方：史莱姆王卡片，称号硬直 +20）' });
C('kargo', 2, ['ring'], { hit: 0.03 }, { kinds: ['kargo', 'kargoGoggle'] });
C('expeller', 2, ['head', 'belt'], { str: 10, int: 10 }, { kinds: ['expeller', 'expellerAxe'] });
C('knight', 3, ['top', 'bottom'], { hp: 400, defPct: 0.02 }, { kinds: ['knight', 'hughes'] });
C('lucas', 3, ['weapon'], { aspd: 0.02, cspd: 0.02 }, { desc: '（官方：幼年赫斯卡片，武器攻速 +2%）' });
C('dogrey', 3, ['head'], { crit: 0.03, mcrit: 0.03 }, { desc: '（官方：凯恩卡片，头肩物暴 +4%）' });
C('platani', 3, ['support', 'stone'], { str: 12, int: 12, vit: 12, spr: 12 });
C('skyExpeller', 3, ['neck', 'bracelet', 'ring'], { dark: 14 });
C('seghart', 4, ['weapon'], { light: 20, atk: 50, matk: 50, indep: 50 }, { name: '光之城主塞格哈特卡片', desc: '（官方：武器附魔，光属性攻击）' });
C('sinEye', 4, ['title'], { crit: 0.02, mcrit: 0.02, critDmg: 0.05 });
}
