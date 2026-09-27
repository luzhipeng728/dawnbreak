/* =====================================================================
   外观数据（外观与换装组）：物品 → 武器图、时装套装 → 帧集、头部配件
   不改物品文件，按物品 key / 武器类型 / 套装 id 映射
   ===================================================================== */
// 武器图：武器装扮 > 史诗专属外观 > 武器类型（WEAPON_IMG 由 art/tools/avatar_weapons.py 生成）
//   武器装扮（时装栏 av_weapon，商城组）：一件覆盖三职业 15 种武器类型，图 key = <装扮>_<武器类型>，缺图就显示真实武器
const WEAPON_SKINS = { av_weapon_spring: 'spring', av_weapon_summer: 'summer' };
function weaponArtOf(it, cls, skin) {
  if (!it) return null;                                     // 没拿武器：空手（装扮只改外观，不会凭空变出武器）
  const t = it.wtype || (typeof CLASS_START_WEAPON !== 'undefined' && CLASS_START_WEAPON[it.cls || cls]);
  const sk = skin && (skin.skin || WEAPON_SKINS[skin.key]);   // 商城物品带 skin 字段；没有就按 key 查表
  if (sk && t && WEAPON_IMG[`${sk}_${t}`]) return `${sk}_${t}`;
  if (WEAPON_IMG[it.key]) return it.key;
  return t && WEAPON_IMG[t] ? t : null;
}
// 时装套装（物品的 set 字段）→ 帧集 id：art/final/spr/<职业>@<id>/，分包 spr:<职业>@<id>
const AVATAR_SETS = {
  av_festival: { id: 'festival', name: '庆典时装' },
  av_spring: { id: 'spring', name: '锦鲤贺岁' },
  av_sky1: { id: 'sky1', name: '天穹圣翼' },
  av_summer: { id: 'summer', name: '晴空海滩' },
  av_sky2: { id: 'sky2', name: '炎龙之魂' },
  av_academy: { id: 'academy', name: '星辉学院' },
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
  // 天空套一「天穹圣翼」：悬浮天使光环（两侧小金翼）、白羽发饰；脸部无配件
  av_hat_sky1: { img: 'sky1_hat', pos: { sword: [4, -50, -0.08, 0.72], gun: [4, -50, -0.08, 0.72], mage: [4, -50, -0.08, 0.72] } },
  av_hair_sky1: { img: 'sky1_hair', pos: { sword: [-32, -2, 0, 0.7], gun: [-32, -2, 0, 0.7], mage: [-32, -2, 0, 0.7] } },
  // 夏日「晴空海滩」：宽檐草帽（蓝丝带）、扶桑花发夹、粉色心形墨镜
  av_hat_summer: { img: 'summer_hat', pos: { sword: [4, -24, 0.2, 0.62], gun: [4, -24, 0.2, 0.62], mage: [4, -24, 0.2, 0.62] } },
  av_hair_summer: { img: 'summer_hair', pos: { sword: [-30, 6, 0, 0.75], gun: [-30, 6, 0, 0.75], mage: [-30, 6, 0, 0.75] } },
  av_face_summer: { img: 'summer_face', face: 1, pos: { sword: [9, 25, 0, 0.66], gun: [21, 14, 0, 0.66], 'gun@': [24, 9, 0, 0.66], mage: [18, 38, 0, 0.66], 'mage@': [21, 6, 0, 0.66] } },
  // 天空套二「炎龙之魂」：一对黑红龙角、火焰发饰；脸部无配件
  av_hat_sky2: { img: 'sky2_hat', pos: { sword: [2, -36, -0.1, 0.62], gun: [2, -36, -0.1, 0.62], mage: [2, -36, -0.1, 0.62] } },
  av_hair_sky2: { img: 'sky2_hair', pos: { sword: [-30, 0, 0, 0.75], gun: [-30, 0, 0, 0.75], mage: [-30, 0, 0, 0.75] } },
  // 学院「星辉学院」：藏青贝雷帽（金色校徽）、红格纹蝴蝶结、黑框方形眼镜
  av_hat_academy: { img: 'academy_hat', pos: { sword: [0, -30, -0.12, 0.66], gun: [0, -30, -0.12, 0.66], mage: [0, -30, -0.12, 0.66] } },
  av_hair_academy: { img: 'academy_hair', pos: { sword: [-32, 14, 0, 0.6], gun: [-32, 14, 0, 0.6], mage: [-32, 14, 0, 0.6] } },
  av_face_academy: { img: 'academy_face', face: 1, pos: { sword: [9, 25, 0, 0.66], gun: [21, 14, 0, 0.66], 'gun@': [24, 9, 0, 0.66], mage: [18, 38, 0, 0.66], 'mage@': [21, 6, 0, 0.66] } },
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
  return { wpn: weaponArtOf(eq.weapon, cls, eq.av_weapon), set, acc };
}
// 职业默认外观（选角立绘、路人、决斗场对手等没有装备信息的模型）
function defaultLook(cls) {
  const t = typeof CLASS_START_WEAPON !== 'undefined' ? CLASS_START_WEAPON[cls] : null;
  return { wpn: t && WEAPON_IMG[t] ? t : null, set: null, acc: [] };
}
// 路人冒险家：随机武器（偶尔史诗）+ 一定几率穿时装
function avatarRandomLook(cls) {
  const types = Object.keys(WEAPON_IMG).filter(k => WEAPON_IMG[k].type && typeof WTYPES !== 'undefined' && WTYPES[WEAPON_IMG[k].type] && WTYPES[WEAPON_IMG[k].type].cls === cls);
  const base = types.filter(k => k === WEAPON_IMG[k].type), ep = types.filter(k => k.startsWith('ep_'));
  const wpn = ep.length && Math.random() < 0.2 ? pick(ep) : base.length ? pick(base) : defaultLook(cls).wpn;
  const sets = Object.values(AVATAR_SETS).filter(S => SPR_DATA[`${cls}@${S.id}`]);
  const set = sets.length && Math.random() < 0.35 ? pick(sets).id : null;
  const acc = set ? Object.keys(AVATAR_ACC).filter(k => k.endsWith('_' + set) && Math.random() < 0.6) : [];
  return { wpn, set, acc };
}
