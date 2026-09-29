/* =====================================================================
   商城物品库（商城组）：货币、高级装扮 / 稀有装扮（天空）、武器装扮、宠物与宠物装备、光环、称号、宝珠、券、合成器、箱子、礼包
   设计见 docs/SHOP.md。所有商城物品都带 cash: true；图标在 art/final/cash/<cashIcon>.webp（没有时回退到按类型的通用图标）
   新装备栏（都用 av_ 前缀：自动进“时装”页签、没有耐久、不能强化 / 分解）：
     av_weapon 武器装扮、av_aura 光环、av_pet 宠物、av_petR / av_petB / av_petG 红 / 蓝 / 绿宠物装备
   ===================================================================== */
const CASH_SLOTS = ['av_weapon', 'av_aura', 'av_pet', 'av_petR', 'av_petB', 'av_petG'];
SLOTS.push(...CASH_SLOTS.filter(s => !SLOTS.includes(s)));
Object.assign(SLOT_NAME, { av_weapon: '武器装扮', av_aura: '光环', av_pet: '宠物', av_petR: '红色宠物装备', av_petB: '蓝色宠物装备', av_petG: '绿色宠物装备' });
// 个人信息 → 时装页：左右两列各多一格（武器装扮 / 光环），下面一排宠物 + 宠物装备（宠物另外还有自己的窗口 pet）
if (typeof AV_LEFT !== 'undefined' && !AV_LEFT.includes('av_weapon')) AV_LEFT.push('av_weapon');
if (typeof AV_RIGHT !== 'undefined' && !AV_RIGHT.includes('av_aura')) AV_RIGHT.push('av_aura');
if (typeof AV_BOTTOM !== 'undefined') for (const s of ['av_pet', 'av_petR', 'av_petB', 'av_petG']) if (!AV_BOTTOM.includes(s)) AV_BOTTOM.push(s);   // 个人信息的时装页：宠物 + 宠物装备一排

/* ---- 货币（计数型：进背包时直接加余额，不占格子；见 game/shop.js 的 inv.add 包装） ---- */
defineItem('cera', { kind: 'use', name: '点券', rar: 3, price: 1, noSell: true, cash: true, cashIcon: 'cera', desc: '破晓商城的通用货币。获得后自动存入点券余额。' });
defineItem('shard_box', { kind: 'mat', name: '魔盒碎片', rar: 2, price: 1, noSell: true, cash: true, cashIcon: 'shard_box', desc: '每打开 1 个魔盒获得 1 个。可以在“兑换商店”换取好东西。获得后自动存入余额。' });
defineItem('coin_gift', { kind: 'mat', name: '礼包币', rar: 3, price: 1, noSell: true, cash: true, cashIcon: 'coin_gift', desc: '节日礼包附赠的纪念币。可以在“兑换商店 · 礼包币”换取抽奖券、宠物装备等。获得后自动存入余额。' });
const CASH_CUR = { cera: 'cera', shard_box: 'shard', coin_gift: 'gcoin' };

/* ---- 时装（高级装扮 rar 1 / 稀有装扮 = 天空 rar 2）：可自选属性（官方装扮属性选择） ---- */
// 每个部位的可选属性：[属性, 高级数值, 稀有数值]
const AV_OPTS = {
  head: [['int', 6, 10], ['spr', 6, 10], ['cspd', 0.02, 0.03], ['str', 6, 10]],
  face: [['aspd', 0.015, 0.025], ['mdef', 40, 70], ['hardness', 20, 35], ['resAll', 6, 10]],
  top: [['str', 8, 14], ['int', 8, 14], ['vit', 8, 14], ['spr', 8, 14]],
  bottom: [['hp', 200, 340], ['mp', 160, 270], ['def', 40, 70]],
  belt: [['evade', 0.02, 0.03], ['resAll', 6, 10], ['str', 6, 10], ['vit', 6, 10]],
  shoes: [['mspd', 0.04, 0.06], ['str', 6, 10], ['vit', 6, 10]],
};
const AV_OPT_OF = { av_hair: 'head', av_hat: 'head', av_face: 'face', av_chest: 'face', av_top: 'top', av_bottom: 'bottom', av_belt: 'belt', av_shoes: 'shoes' };
const AV_PIECE_SLOTS = ['av_hair', 'av_hat', 'av_face', 'av_chest', 'av_top', 'av_bottom', 'av_belt', 'av_shoes'];
// 物品定义的可选属性表：[[属性, 数值]...]
function cashAvOpts(D) { const T = D && AV_OPTS[AV_OPT_OF[D.slot]]; return T ? T.map(o => [o[0], D.rar >= 2 ? o[2] : o[1]]) : null; }
// 实例当前的属性：it.opt（属性名）没选过时用第一项
function cashAvOpt(D, opt) { const T = cashAvOpts(D); if (!T) return null; return T.find(o => o[0] === opt) || T[0]; }
// 包装 applyDef：按实例的 it.opt 追加自选属性（normalizeItem / makeItem 都走这里，改平衡后旧存档也跟着变）
{ const applyDef0 = applyDef; applyDef = function (it, D) { applyDef0(it, D); if (D && D.avOpt && it && it.st) { const O = cashAvOpt(D, it.opt); if (O) it.st[O[0]] = +((it.st[O[0]] || 0) + O[1]).toFixed(3); } }; }

const CASH_SETS = {
  av_spring: { name: '锦鲤贺岁', tier: 'adv', theme: '春节', desc: '红金唐装配醒狮帽，福气满满地迎接新春。', parts: { av_hair: '锦鲤贺岁绒球头饰', av_hat: '锦鲤贺岁醒狮帽', av_face: '锦鲤贺岁圆墨镜', av_chest: '锦鲤贺岁长命锁', av_top: '锦鲤贺岁唐装上衣', av_bottom: '锦鲤贺岁下装', av_belt: '锦鲤贺岁腰封', av_shoes: '锦鲤贺岁绣花鞋' } },
  av_summer: { name: '晴空海滩', tier: 'adv', theme: '夏日', desc: '扶桑花与椰子树，把整个夏天穿在身上。', parts: { av_hair: '晴空海滩扶桑花发夹', av_hat: '晴空海滩草编遮阳帽', av_face: '晴空海滩心形墨镜', av_chest: '晴空海滩贝壳项链', av_top: '晴空海滩上衣', av_bottom: '晴空海滩下装', av_belt: '晴空海滩编织腰带', av_shoes: '晴空海滩凉鞋' } },
  av_academy: { name: '星辉学院', tier: 'adv', theme: '学院', desc: '星辉学院的制服，据说穿上以后成绩会变好。', parts: { av_hair: '星辉学院格纹蝴蝶结', av_hat: '星辉学院贝雷帽', av_face: '星辉学院方框眼镜', av_chest: '星辉学院领结', av_top: '星辉学院制服上衣', av_bottom: '星辉学院制服下装', av_belt: '星辉学院皮带', av_shoes: '星辉学院皮鞋' } },
  av_sky1: { name: '天穹圣翼', tier: 'rare', theme: '天空', desc: '传说中守护天界之门的圣翼骑士的装束。集齐 8 件，圣光与羽毛会环绕在身边。', parts: { av_hair: '天穹圣翼之羽', av_hat: '天穹圣翼之冠', av_face: '天穹圣翼之眸', av_chest: '天穹圣翼之心', av_top: '天穹圣翼之铠', av_bottom: '天穹圣翼之裳', av_belt: '天穹圣翼之带', av_shoes: '天穹圣翼之靴' } },
  av_sky2: { name: '炎龙之魂', tier: 'rare', theme: '天空', desc: '以炎龙之鳞织成的装束。集齐 8 件，龙炎的火星会从脚下升起。', parts: { av_hair: '炎龙之焰', av_hat: '炎龙之角', av_face: '炎龙之瞳', av_chest: '炎龙之爪', av_top: '炎龙之鳞', av_bottom: '炎龙之裳', av_belt: '炎龙之扣', av_shoes: '炎龙之靴' } },
};
const CASH_ADV_SETS = Object.keys(CASH_SETS).filter(s => CASH_SETS[s].tier === 'adv');
const CASH_SKY_SETS = Object.keys(CASH_SETS).filter(s => CASH_SETS[s].tier === 'rare');
const avKey = (set, slot) => `${slot}_${set.slice(3)}`;   // av_spring + av_top → av_top_spring（和庆典时装同一规则，外观组按它映射配件）
for (const set in CASH_SETS) {
  const S = CASH_SETS[set], rare = S.tier === 'rare';
  defineSet(set, { name: `${S.name}${rare ? '（稀有装扮）' : '（高级装扮）'}`, bonus: rare
    ? { 3: { st: { str: 10, int: 10, vit: 10, spr: 10 }, desc: '四维 +10' }, 5: { st: { aspd: 0.02, cspd: 0.02, mspd: 0.02 }, desc: '攻击 / 施放 / 移动速度 +2%' }, 8: { st: { dmgUp: 0.03, crit: 0.015, mcrit: 0.015, cdr: 0.05 }, desc: '伤害增加 3%，暴击率 +1.5%，技能冷却 -5%；激活套装光效' } }
    : { 3: { st: { str: 5, int: 5, vit: 5, spr: 5 }, desc: '四维 +5' }, 5: { st: { aspd: 0.015, cspd: 0.015 }, desc: '攻击 / 施放速度 +1.5%' }, 8: { st: { dmgUp: 0.01, mspd: 0.02, cdr: 0.02 }, desc: '伤害增加 1%，移动速度 +2%，技能冷却 -2%' } } });
  for (const slot of AV_PIECE_SLOTS) {
    const key = avKey(set, slot), f = rare ? 5 : 3;
    defineItem(key, { kind: 'equip', slot, lvl: 1, rar: rare ? 2 : 1, price: rare ? 4000 : 800, name: S.parts[slot], set, avSet: set, avOpt: true, cash: true, cashIcon: key,
      st: slot === 'av_top' ? { str: f, int: f, vit: f, spr: f } : {}, durMax: 0, noEnhance: true, noDisassemble: true, noDrop: true,
      desc: `${rare ? '稀有装扮（天空）' : '高级装扮'} · ${S.desc}可以在商城“属性选择”里更换属性（第一次免费）。` });
    SETS[set].pieces.push(key);
  }
}
const CASH_SLOT_PRICE = { av_top: 2600, av_bottom: 2200, av_shoes: 1600, av_hair: 1500, av_hat: 1500, av_face: 1200, av_chest: 1200, av_belt: 1200 };

/* ---- 武器装扮：不分职业，一件覆盖所有武器类型（外观组按 eq.av_weapon + 武器类型换图，缺图时显示真实武器） ---- */
defineItem('av_weapon_spring', { kind: 'equip', slot: 'av_weapon', lvl: 1, rar: 1, price: 800, name: '金龙贺岁武器装扮', skin: 'spring', cash: true, cashIcon: 'av_weapon_spring', st: { aspd: 0.01, cspd: 0.015 }, durMax: 0, noEnhance: true, noDisassemble: true, noDrop: true, desc: '红金配色、盘着金龙的武器外观。适用于所有职业的所有武器类型。' });
defineItem('av_weapon_summer', { kind: 'equip', slot: 'av_weapon', lvl: 1, rar: 1, price: 800, name: '清凉一夏武器装扮', skin: 'summer', cash: true, cashIcon: 'av_weapon_summer', st: { aspd: 0.01, cspd: 0.015 }, durMax: 0, noEnhance: true, noDisassemble: true, noDrop: true, desc: '冰棍、水枪、椰子杖……清凉搞怪的夏日武器外观。适用于所有职业的所有武器类型。' });
defineItem('av_weapon_holywing', { kind: 'equip', slot: 'av_weapon', lvl: 1, rar: 1, price: 800, name: '天穹圣翼武器装扮', skin: 'holywing', cash: true, cashIcon: 'av_weapon_holywing', st: { aspd: 0.01, cspd: 0.015 }, durMax: 0, noEnhance: true, noDisassemble: true, noDrop: true, desc: '白金铸身、展开圣翼的武器外观，和天空套“天穹圣翼”是一对。适用于所有职业的所有武器类型。' });
defineItem('av_weapon_flamedragon', { kind: 'equip', slot: 'av_weapon', lvl: 1, rar: 1, price: 800, name: '炎龙之魂武器装扮', skin: 'flamedragon', cash: true, cashIcon: 'av_weapon_flamedragon', st: { aspd: 0.01, cspd: 0.015 }, durMax: 0, noEnhance: true, noDisassemble: true, noDrop: true, desc: '赤红龙鳞包裹、裂纹里流淌着熔岩的武器外观，和天空套“炎龙之魂”是一对。适用于所有职业的所有武器类型。' });
defineItem('av_weapon_academy', { kind: 'equip', slot: 'av_weapon', lvl: 1, rar: 1, price: 800, name: '星辉学院武器装扮', skin: 'academy', cash: true, cashIcon: 'av_weapon_academy', st: { aspd: 0.01, cspd: 0.015 }, durMax: 0, noEnhance: true, noDisassemble: true, noDrop: true, desc: '蓝紫星空、银色月牙与金色星星的武器外观，星辉学院的毕业纪念。适用于所有职业的所有武器类型。' });
defineItem('av_weapon_gothic', { kind: 'equip', slot: 'av_weapon', lvl: 1, rar: 1, price: 800, name: '暗夜哥特武器装扮', skin: 'gothic', cash: true, cashIcon: 'av_weapon_gothic', st: { aspd: 0.01, cspd: 0.015 }, durMax: 0, noEnhance: true, noDisassemble: true, noDrop: true, desc: '黑铁银纹、蝙蝠翼与深红玫瑰的武器外观，也会在魔盒大奖里出现。适用于所有职业的所有武器类型。' });

/* ---- 宠物：跟在角色身后（game/shop_pet.js 绘制），art/final/pet/<id>_<帧>.webp ---- */
const PETS = {
  lion: { name: '福瑞小醒狮', h: 44, fly: 0, col: '#ff5a3a' },
  seal: { name: '冲浪小海豹', h: 40, fly: 0, col: '#6ac8ff' },
  owl: { name: '学院小猫头鹰', h: 42, fly: 1, col: '#c89a60' },
  panda: { name: '团团熊猫', h: 44, fly: 0, col: '#f0f0f0' },
  fox: { name: '幻彩星狐', h: 44, fly: 0, col: '#c8a0ff' },
  pegasus: { name: '至尊·金翼天马', h: 58, fly: 1, col: '#ffd86a' },
};
const defPet = (key, def) => defineItem(key, { kind: 'equip', slot: 'av_pet', lvl: 1, price: 1000, cash: true, cashIcon: key, durMax: 0, noEnhance: true, noDisassemble: true, noDrop: true, ...def });
defPet('pet_lion', { name: '福瑞小醒狮', rar: 2, pet: 'lion', st: { str: 8, int: 8, vit: 8, spr: 8, aspd: 0.015 }, desc: '舞狮队里最小的一只，跟着你到处讨红包。' });
defPet('pet_seal', { name: '冲浪小海豹', rar: 2, pet: 'seal', st: { str: 8, int: 8, vit: 8, spr: 8, mspd: 0.03 }, desc: '抱着冲浪板的小海豹，走路一扭一扭的。' });
defPet('pet_owl', { name: '学院小猫头鹰', rar: 2, pet: 'owl', st: { str: 8, int: 8, vit: 8, spr: 8, cspd: 0.02 }, desc: '星辉学院的吉祥物，戴着小小的学士帽。' });
defPet('pet_panda', { name: '团团熊猫', rar: 2, pet: 'panda', st: { str: 8, int: 8, vit: 8, spr: 8, hpPct: 0.03 }, desc: '抱着竹笋的小熊猫，吃饱了就跟着你慢慢走。HP 上限 +3%。' });
defPet('pet_fox', { name: '幻彩星狐', rar: 3, pet: 'fox', st: { str: 10, int: 10, vit: 10, spr: 10, crit: 0.01, mcrit: 0.01, mspd: 0.02, cdr: 0.02 }, desc: '魔盒 / 宠物蛋限定。尾巴上的星星会随着心情变色。' });
defPet('pet_pegasus', { name: '至尊·金翼天马', rar: 4, pet: 'pegasus', st: { str: 15, int: 15, vit: 15, spr: 15, dmgUp: 0.02, aspd: 0.02, cspd: 0.02, mspd: 0.02, cdr: 0.05 }, desc: '至尊宠物。技能冷却 -5%。披着金色羽翼的小天马，据说能把主人带到天空之上。' });
// 宠物装备（红 攻击 / 蓝 速度 / 绿 属性）
const defPetGear = (key, def) => defineItem(key, { kind: 'equip', lvl: 1, price: 800, cash: true, cashIcon: key, durMax: 0, noEnhance: true, noDisassemble: true, noDrop: true, ...def });
defPetGear('petR_1', { slot: 'av_petR', name: '炽焰之心', rar: 2, st: { atkPct: 0.01 }, desc: '红色宠物装备。攻击力 +1%。' });
defPetGear('petR_2', { slot: 'av_petR', name: '炎龙之心', rar: 3, st: { atkPct: 0.02 }, desc: '红色宠物装备。攻击力 +2%。' });
defPetGear('petB_1', { slot: 'av_petB', name: '疾风之羽', rar: 2, st: { aspd: 0.015, cspd: 0.015, mspd: 0.015 }, desc: '蓝色宠物装备。攻击 / 施放 / 移动速度 +1.5%。' });
defPetGear('petB_2', { slot: 'av_petB', name: '天穹之羽', rar: 3, st: { aspd: 0.025, cspd: 0.025, mspd: 0.025, crit: 0.01, mcrit: 0.01 }, desc: '蓝色宠物装备。攻击 / 施放 / 移动速度 +2.5%，暴击率 +1%。' });
defPetGear('petG_1', { slot: 'av_petG', name: '翠玉之叶', rar: 2, st: { str: 5, int: 5, vit: 5, spr: 5, elemAll: 5 }, desc: '绿色宠物装备。四维 +5，所有属性强化 +5。' });
defPetGear('petG_2', { slot: 'av_petG', name: '世界树之叶', rar: 3, st: { str: 10, int: 10, vit: 10, spr: 10, elemAll: 10 }, desc: '绿色宠物装备。四维 +10，所有属性强化 +10。' });

/* ---- 光环：画在脚下（game/shop_pet.js），art/final/aura/<id>.webp ---- */
const AURAS = {
  spring: { name: '祥云瑞彩', col: '255,120,70', spin: 0.5 },
  summer: { name: '浪花之环', col: '110,200,255', spin: -0.6 },
  academy: { name: '星辉魔法阵', col: '170,150,255', spin: 0.4 },
  box: { name: '幻彩星轨', col: '255,140,230', spin: 0.8 },
  supreme: { name: '至尊·天界圣环', col: '255,215,110', spin: 0.35 },
};
const defAura = (key, def) => defineItem(key, { kind: 'equip', slot: 'av_aura', lvl: 1, price: 1000, cash: true, cashIcon: key, durMax: 0, noEnhance: true, noDisassemble: true, noDrop: true, ...def });
defAura('aura_spring', { name: '祥云瑞彩', rar: 2, aura: 'spring', st: { str: 5, int: 5, vit: 5, spr: 5, aspd: 0.01 }, desc: '脚下翻涌着红金色的祥云。' });
defAura('aura_summer', { name: '浪花之环', rar: 2, aura: 'summer', st: { str: 5, int: 5, vit: 5, spr: 5, mspd: 0.02 }, desc: '清凉的浪花在脚边打着旋。' });
defAura('aura_academy', { name: '星辉魔法阵', rar: 2, aura: 'academy', st: { str: 5, int: 5, vit: 5, spr: 5, cspd: 0.015 }, desc: '星辉学院入学考试用的魔法阵，一直亮着。' });
defAura('aura_box', { name: '幻彩星轨', rar: 3, aura: 'box', st: { str: 10, int: 10, vit: 10, spr: 10, crit: 0.01, mcrit: 0.01 }, desc: '魔盒限定光环。彩色的星轨绕着脚下旋转。' });
defAura('aura_supreme', { name: '至尊·天界圣环', rar: 4, aura: 'supreme', st: { str: 12, int: 12, vit: 12, spr: 12, aspd: 0.02, cspd: 0.02, mspd: 0.02, elemAll: 6, cdr: 0.03 }, desc: '至尊光环。技能冷却 -3%。天界的圣光在脚下凝成圆环。' });

/* ---- 称号 ---- */
const defCashTitle = (key, def) => defineTitle(key, { lvl: 1, price: 1000, cash: true, cashIcon: key, noDrop: true, shopOnly: true, ...def });
defCashTitle('title_spring', { name: '锦鲤附体', rar: 3, st: { str: 12, int: 12, vit: 12, spr: 12, crit: 0.02, mcrit: 0.02, cdr: 0.02 }, fx: { dmgUp: 0.02 }, desc: '新春礼包称号。好运连连，锦鲤附体！' });
defCashTitle('title_summer', { name: '晴空之子', rar: 3, st: { str: 12, int: 12, vit: 12, spr: 12, mspd: 0.03, cdr: 0.02 }, fx: { dmgUp: 0.02 }, desc: '夏日礼包称号。和晴空一样明朗。' });
defCashTitle('title_academy', { name: '首席优等生', rar: 3, st: { str: 12, int: 12, vit: 12, spr: 12, cspd: 0.03, cdr: 0.02 }, fx: { dmgUp: 0.02 }, desc: '学院礼包称号。星辉学院的首席。' });
defCashTitle('title_box', { name: '魔盒收藏家', rar: 3, st: { str: 12, int: 12, vit: 12, spr: 12, cdr: 0.02 }, fx: { goldUp: 0.1 }, desc: '魔盒限定称号。金币获得量 +10%。' });
defCashTitle('title_supreme', { name: '至尊·破晓之光', rar: 4, st: { str: 20, int: 20, vit: 20, spr: 20, crit: 0.02, mcrit: 0.02, mspd: 0.02, cdr: 0.02 }, fx: { dmgUp: 0.04 }, desc: '至尊称号。多买多送奖励：在破晓时分照亮阿拉德的光。' });

/* ---- 宝珠（附魔：装备深化组实现，每件装备 1 个槽；on 可以写 slot 名或别名 armor / acc / special / avatar） ---- */
const defOrb = (key, def) => defineItem(key, { kind: 'mat', price: 500, cash: true, cashIcon: def.cashIcon || key, ...def });
defOrb('orb_spring', { name: '锦鲤宝珠', rar: 3, orb: { on: ['title'], st: { str: 8, int: 8, vit: 8, spr: 8, dmgUp: 0.01 } }, desc: '新春节日宝珠。附魔到称号：四维 +8，伤害增加 +1%。' });
defOrb('orb_summer', { name: '晴空宝珠', rar: 3, orb: { on: ['title'], st: { str: 8, int: 8, vit: 8, spr: 8, dmgUp: 0.01 } }, desc: '夏日节日宝珠。附魔到称号：四维 +8，伤害增加 +1%。' });
defOrb('orb_academy', { name: '星辉宝珠', rar: 3, orb: { on: ['title'], st: { str: 8, int: 8, vit: 8, spr: 8, dmgUp: 0.01 } }, desc: '学院节日宝珠。附魔到称号：四维 +8，伤害增加 +1%。' });
defOrb('orb_title1', { name: '称号宝珠·力智', rar: 2, orb: { on: ['title'], st: { str: 6, int: 6 } }, desc: '附魔到称号：力量 / 智力 +6。' });
defOrb('orb_title2', { name: '称号宝珠·会心', rar: 3, orb: { on: ['title'], st: { crit: 0.02, mcrit: 0.02 } }, desc: '附魔到称号：物理 / 魔法暴击率 +2%。' });
defOrb('orb_title_supreme', { name: '至尊称号宝珠', rar: 4, orb: { on: ['title'], st: { str: 12, int: 12, vit: 12, spr: 12, dmgUp: 0.015 } }, desc: '至尊宝珠。附魔到称号：四维 +12，伤害增加 +1.5%。' });
defOrb('orb_weapon1', { name: '武器宝珠·锋锐', rar: 2, orb: { on: ['weapon'], st: { atk: 20, matk: 20, indep: 20 } }, desc: '附魔到武器：物理 / 魔法 / 独立攻击力 +20。' });
defOrb('orb_weapon2', { name: '武器宝珠·元素', rar: 3, orb: { on: ['weapon'], st: { elemAll: 10 } }, desc: '附魔到武器：所有属性强化 +10。' });
defOrb('orb_armor1', { name: '防具宝珠·坚韧', rar: 2, orb: { on: ['armor'], st: { vit: 8, spr: 8, hp: 80 } }, desc: '附魔到防具（上衣 / 头肩 / 下装 / 腰带 / 鞋）：体力 / 精神 +8，HP 上限 +80。' });
defOrb('orb_acc1', { name: '首饰宝珠·灵巧', rar: 2, orb: { on: ['acc'], st: { str: 6, int: 6, hit: 0.01 } }, desc: '附魔到首饰：力量 / 智力 +6，命中率 +1%。' });
defOrb('orb_av1', { name: '装扮宝珠·迅捷', rar: 2, orb: { on: ['avatar'], st: { aspd: 0.01, cspd: 0.01 } }, desc: '附魔到时装（含武器装扮 / 光环）：攻击 / 施放速度 +1%。' });
defOrb('orb_av2', { name: '装扮宝珠·华丽', rar: 3, orb: { on: ['avatar'], st: { str: 5, int: 5, vit: 5, spr: 5 } }, desc: '附魔到时装（含武器装扮 / 光环）：四维 +5。' });
defOrb('orb_pet1', { name: '宠物宝珠·灵气', rar: 3, orb: { on: ['av_pet'], st: { str: 8, int: 8 } }, desc: '附魔到宠物：力量 / 智力 +8。' });
defOrb('orb_pet_supreme', { name: '至尊宠物宝珠', rar: 4, orb: { on: ['av_pet'], st: { str: 12, int: 12, vit: 12, spr: 12, aspd: 0.015, cspd: 0.015, mspd: 0.015 } }, desc: '至尊宝珠。附魔到宠物：四维 +12，攻击 / 施放 / 移动速度 +1.5%。' });
const ORB_TIER = { rare: ['orb_title1', 'orb_weapon1', 'orb_armor1', 'orb_acc1', 'orb_av1'], art: ['orb_title2', 'orb_weapon2', 'orb_av2', 'orb_pet1', 'orb_spring', 'orb_summer', 'orb_academy'], supreme: ['orb_title_supreme', 'orb_pet_supreme'] };

/* ---- 可以直接使用的商城道具（cashUse：由 game/shop.js 包装 inv.useItem 统一处理） ---- */
const defCashUse = (key, def) => defineItem(key, { kind: 'use', price: 10, noSell: true, cash: true, cashIcon: def.cashIcon || key, use: { open: def.cashUse === 'box' || def.cashUse === 'pack' || def.cashUse === 'red' }, ...def });
// 券
defCashUse('tk_maxlv', { name: '一键满级券', rar: 5, cashUse: 'maxlv', desc: '使用后当前角色直接升到满级（Lv.60），每一级的 SP 照常获得。主线任务不会自动完成，可以回头补做领奖励。' });
defCashUse('tk_enh7', { name: '+7 装备强化券', rar: 2, cashUse: 'ticket', ticket: { kind: 'enh', lvl: 7 }, desc: '选择一件装备，把强化等级直接变为 +7（已经 +7 以上的不能用；增幅过的装备不能用）。' });
defCashUse('tk_enh10', { name: '+10 装备强化券', rar: 4, cashUse: 'ticket', ticket: { kind: 'enh', lvl: 10 }, desc: '选择一件装备，把强化等级直接变为 +10（已经 +10 以上的不能用；增幅过的装备不能用）。' });
defCashUse('tk_amp7', { name: '+7 装备增幅券', rar: 3, cashUse: 'ticket', ticket: { kind: 'amp', lvl: 7 }, desc: '选择一件装备，把增幅等级直接变为 +7（没有异次元属性时按选择赋予；强化过的装备会转为增幅）。' });
defCashUse('tk_amp10', { name: '+10 装备增幅券', rar: 5, cashUse: 'ticket', ticket: { kind: 'amp', lvl: 10 }, desc: '选择一件装备，把增幅等级直接变为 +10（没有异次元属性时按选择赋予；强化过的装备会转为增幅）。' });
defCashUse('tk_avatar', { name: '高级装扮兑换券', rar: 2, cashUse: 'ticket', ticket: { kind: 'avatar' }, desc: '自选套装、部位和属性，兑换 1 件高级装扮（锦鲤贺岁 / 晴空海滩 / 星辉学院）。' });
defCashUse('tk_sky', { name: '天空套部件兑换券', rar: 4, cashUse: 'ticket', ticket: { kind: 'sky' }, desc: '自选天空套、部位和属性，兑换 1 件稀有装扮（天穹圣翼 / 炎龙之魂）。' });
defCashUse('tk_avopt', { name: '装扮属性变更券', rar: 1, cashUse: 'ticket', ticket: { kind: 'avopt' }, desc: '更换 1 次时装的自选属性（在商城“属性选择”里使用）。每件时装第一次选择属性免费。' });
defCashUse('tk_lotto', { name: '破晓启示抽奖券', rar: 3, cashUse: 'lotto', desc: '参加“破晓启示”不放回抽奖，每次消耗 1 张。节日礼包附赠。' });
// 合成器
defCashUse('synth_basic', { name: '装扮合成器', rar: 1, cashUse: 'synth', synth: { rate: 0.2, need: 2 }, desc: '放入 2 件同部位的高级装扮：20% 几率合成为指定天空套的该部位（稀有装扮）；失败时得到 1 件随机的同部位高级装扮。' });
defCashUse('synth_gold', { name: '黄金装扮合成器', rar: 3, cashUse: 'synth', synth: { rate: 0.3, need: 2 }, desc: '放入 2 件同部位的高级装扮：30% 几率合成为指定天空套的该部位；失败时得到 1 件随机的同部位高级装扮。' });
defCashUse('synth_dream', { name: '梦想装扮合成器', rar: 4, cashUse: 'synth', synth: { rate: 1, need: 8, any: true }, desc: '放入任意 8 件高级装扮：100% 合成为指定天空套的指定部位。' });
// 点券红包
defCashUse('cera_s', { name: '点券红包（小）', rar: 2, cashUse: 'red', red: [50, 200], desc: '打开获得 50~200 点券。' });
defCashUse('cera_m', { name: '点券红包（中）', rar: 3, cashUse: 'red', red: [300, 800], desc: '打开获得 300~800 点券。' });
defCashUse('cera_l', { name: '点券红包（大）', rar: 4, cashUse: 'red', red: [2000, 5000], desc: '打开获得 2000~5000 点券！' });
// 箱子（奖池在 content/cash/catalog.js 的 CASH_BOXES）
defCashUse('box_magic', { name: '魔盒', rar: 3, cashUse: 'box', desc: '打开随机获得一件好东西：天空套部件兑换券、史诗装备、限定光环 / 称号、强化券、宠物蛋……每开 1 个得 1 个魔盒碎片，连续 100 次必出大奖。' });
defCashUse('box_magic2', { name: '黄金魔盒', rar: 4, cashUse: 'box', desc: '只会开出魔盒的“大奖”和“稀有”档奖励（大奖 15%）。计入魔盒保底，获得 3 个魔盒碎片。' });
defCashUse('box_equip', { name: '装备礼盒', rar: 2, cashUse: 'box', desc: '打开获得 1 件与等级相符的随机装备：高级 50% / 稀有 30% / 神器 14% / 传说 5% / 史诗 1%。' });
defCashUse('box_epic', { name: '史诗自选礼盒', rar: 5, cashUse: 'box', desc: '从适合自己等级与职业的单件史诗装备中自选 1 件。' });
defCashUse('box_orb', { name: '宝珠礼盒', rar: 2, cashUse: 'box', desc: '打开获得 1 颗随机宝珠：稀有 70% / 神器 27% / 至尊 3%。' });
defCashUse('egg_pet', { name: '宠物蛋', rar: 3, cashUse: 'box', desc: '孵出一只宠物：福瑞小醒狮 / 冲浪小海豹 / 学院小猫头鹰 / 团团熊猫，低几率孵出幻彩星狐，极低几率孵出至尊·金翼天马！' });
defCashUse('box_petgear', { name: '宠物装备礼盒', rar: 2, cashUse: 'box', desc: '打开获得 1 件随机宠物装备（红 / 蓝 / 绿），有几率是神器品级。' });
defCashUse('box_petgear2', { name: '神器宠物装备礼盒', rar: 3, cashUse: 'box', desc: '打开获得 1 件神器宠物装备（红 / 蓝 / 绿随机）。' });
defCashUse('sel_petgear2', { name: '神器宠物装备自选礼盒', rar: 4, cashUse: 'box', desc: '从 3 件神器宠物装备（炎龙之心 / 天穹之羽 / 世界树之叶）中自选 1 件。' });
defCashUse('box_supply', { name: '消耗品礼盒', rar: 1, cashUse: 'box', desc: '打开获得 3 份随机补给：药剂、秘药、复活币、抗疲劳秘药……' });
defCashUse('box_gold', { name: '金币箱', rar: 2, cashUse: 'box', desc: '打开获得与等级相符的金币，有几率 5 倍、20 倍！' });
defCashUse('box_avatar', { name: '高级装扮随机礼盒', rar: 2, cashUse: 'box', desc: '从 3 套高级装扮的 24 个部件里随机获得 1 件。合成天空套的好材料。' });
defCashUse('box_mystery', { name: '神秘礼盒', rar: 3, cashUse: 'box', desc: '里面装着另一个箱子……会是魔盒？宠物蛋？还是黄金魔盒？' });
// 礼包（内容在 catalog.js 的 CASH_PACKS）
for (const [k, n, r] of [['pkg_spring', '新春礼包「锦鲤贺岁」', 4], ['pkg_summer', '夏日礼包「晴空海滩」', 4], ['pkg_academy', '学院礼包「星辉学院」', 4], ['pkg_newbie', '新手礼包', 2], ['pkg_lv10', 'Lv10 等级礼包', 2], ['pkg_lv20', 'Lv20 等级礼包', 3], ['pkg_lv30', 'Lv30 等级礼包', 4],
  ['pkg_ltd_box', '限时礼包「魔盒狂欢」', 3], ['pkg_ltd_enh', '限时礼包「强化助力」', 3], ['pkg_ltd_pet', '限时礼包「宠物伙伴」', 3], ['pkg_ltd_synth', '限时礼包「装扮合成」', 3]])
  defCashUse(k, { name: n, rar: r, cashUse: 'pack', cashIcon: k.startsWith('pkg_lv') ? 'pkg_lv' : k.startsWith('pkg_ltd') ? 'pkg_ltd' : k, desc: '右键打开，获得礼包内的全部物品。' });
