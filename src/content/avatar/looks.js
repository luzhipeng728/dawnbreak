/* =====================================================================
   外观数据（外观与换装组）：物品 → 武器图、时装套装 → 帧集、头部配件
   不改物品文件，按物品 key / 武器类型 / 套装 id 映射
   ===================================================================== */
// 武器图：史诗按物品 key 有专属外观，其余按武器类型（WEAPON_IMG 由 art/tools/avatar_weapons.py 生成）
function weaponArtOf(it, cls) {
  if (!it) return null;                                     // 没拿武器：空手
  if (WEAPON_IMG[it.key]) return it.key;
  const t = it.wtype || (typeof CLASS_START_WEAPON !== 'undefined' && CLASS_START_WEAPON[it.cls || cls]);
  return t && WEAPON_IMG[t] ? t : null;
}
// 时装套装（物品的 set 字段）→ 帧集 id：art/final/spr/<职业>@<id>/，分包 spr:<职业>@<id>
const AVATAR_SETS = {
  av_festival: { id: 'festival', name: '庆典时装' },
};
// 头部配件（帽子 / 头部 / 脸部）：按每帧的头部锚点（art/tools/avatar_head.py 求出的站姿头部中心 + 转角）叠加；图 IMG['avatar/<img>']
//   pos[职业 / 职业@ / 职业@套装] = [dx, dy, 转角, 缩放]：配件图中心相对头部锚点的位置（帧像素，站姿朝右时）。
//   穿整套时装时依次找 职业@套装 → 职业@（任意时装：时装都摘了职业默认的帽子，头部锚点和原装不同）→ 职业；face：脸部配件（脸被挡住的帧不画）
const AVATAR_ACC = {
  av_hat_festival: { img: 'festival_hat', pos: { sword: [8, -34, -0.1, 0.72], gun: [8, -34, -0.1, 0.72], mage: [8, -34, -0.1, 0.72] } },
  av_hair_festival: { img: 'festival_hair', pos: { sword: [-36, 16, 0.25, 0.5], gun: [-36, 16, 0.25, 0.5], mage: [-36, 16, 0.25, 0.5] } },
  av_face_festival: { img: 'festival_face', face: 1, pos: { sword: [9, 25, 0, 0.66], gun: [21, 14, 0, 0.66], 'gun@': [24, 9, 0, 0.66], mage: [18, 38, 0, 0.66], 'mage@': [21, 6, 0, 0.66] } },
  // 春节「锦鲤贺岁」（商城组设计）：醒狮头帽、红绒球流苏发簪、金框红片圆墨镜
  av_hat_spring: { img: 'spring_hat', pos: { sword: [4, -36, -0.1, 0.56], gun: [4, -36, -0.1, 0.56], mage: [4, -36, -0.1, 0.56] } },
  av_hair_spring: { img: 'spring_hair', pos: { sword: [-36, 10, 0, 0.7], gun: [-36, 10, 0, 0.7], mage: [-36, 10, 0, 0.7] } },
  av_face_spring: { img: 'spring_face', face: 1, pos: { sword: [9, 25, 0, 0.66], gun: [21, 14, 0, 0.66], 'gun@': [24, 9, 0, 0.66], mage: [18, 38, 0, 0.66], 'mage@': [21, 6, 0, 0.66] } },
};
const AVATAR_ACC_SCALE = 0.8;   // 配件图比游戏里画的大 1.25 倍（art/tools/avatar_acc.py）
/* 外观规则（写给玩家看的说明也用这一段）：
   1. 武器：换武器类型 / 史诗武器，手里的武器跟着变；没装备武器就空手。
   2. 身体：同一套时装的「上衣 + 下装」都穿上，整个人换成这套时装（胸部、腰带、鞋的样子按这套画）；只穿一件不换。
   3. 帽子 / 头部 / 脸部：单独叠加在头上；职业默认造型自带帽子（神枪手的报童帽、魔法师的巫师帽）时，帽子和发饰只在换上整套时装后显示。 */
const AVATAR_HAT_CLS = { gun: 1, mage: 1 };   // 默认造型自带帽子的职业
function lookFromEquip(cls, eq) {
  eq = eq || {};
  const top = eq.av_top, bot = eq.av_bottom, S = top && bot && top.set && top.set === bot.set && AVATAR_SETS[top.set];
  const set = S && SPR_DATA[`${cls}@${S.id}`] ? S.id : null;
  const acc = [];
  for (const slot of ['av_hat', 'av_hair', 'av_face']) {
    const it = eq[slot]; if (!it || !AVATAR_ACC[it.key]) continue;
    if (slot !== 'av_face' && AVATAR_HAT_CLS[cls] && !set) continue;
    acc.push(it.key);
  }
  return { wpn: weaponArtOf(eq.weapon, cls), set, acc };
}
// 职业默认外观（选角立绘、路人、决斗场对手等没有装备信息的模型）
function defaultLook(cls) {
  const t = typeof CLASS_START_WEAPON !== 'undefined' ? CLASS_START_WEAPON[cls] : null;
  return { wpn: t && WEAPON_IMG[t] ? t : null, set: null, acc: [] };
}
// 路人冒险家：随机武器（偶尔史诗）+ 一定几率穿时装
function avatarRandomLook(cls) {
  const types = Object.keys(WEAPON_IMG).filter(k => WEAPON_IMG[k].type && typeof WTYPES !== 'undefined' && WTYPES[WEAPON_IMG[k].type] && WTYPES[WEAPON_IMG[k].type].cls === cls);
  const base = types.filter(k => !k.startsWith('ep_')), ep = types.filter(k => k.startsWith('ep_'));
  const wpn = ep.length && Math.random() < 0.2 ? pick(ep) : base.length ? pick(base) : defaultLook(cls).wpn;
  const sets = Object.values(AVATAR_SETS).filter(S => SPR_DATA[`${cls}@${S.id}`]);
  const set = sets.length && Math.random() < 0.35 ? pick(sets).id : null;
  const acc = set ? Object.keys(AVATAR_ACC).filter(k => k.endsWith('_' + set) && Math.random() < 0.6) : [];
  return { wpn, set, acc };
}
