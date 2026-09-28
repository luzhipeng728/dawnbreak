/* =====================================================================
   外观数据（外观与换装组）：物品 → 武器图、时装套装 → 帧集、头部配件
   不改物品文件，按物品 key / 武器类型 / 套装 id 映射
   ===================================================================== */
// 武器图：武器装扮 > 史诗专属外观 > 品级外观（稀有 / 神器 / 传说）> 武器类型（WEAPON_IMG 由 art/tools/avatar_weapons.py 生成）
//   武器装扮（时装栏 av_weapon，商城组）：一件覆盖三职业 15 种武器类型，图 key = <装扮>_<武器类型>，缺图就显示真实武器
const WEAPON_SKINS = { av_weapon_spring: 'spring', av_weapon_summer: 'summer' };
function weaponArtOf(it, cls, skin) {
  if (!it) return null;                                     // 没拿武器：空手（装扮只改外观，不会凭空变出武器）
  const t = it.wtype || (typeof CLASS_START_WEAPON !== 'undefined' && CLASS_START_WEAPON[it.cls || cls]);
  const sk = skin && (skin.skin || WEAPON_SKINS[skin.key]);   // 商城物品带 skin 字段；没有就按 key 查表
  if (sk && t && WEAPON_IMG[`${sk}_${t}`]) return `${sk}_${t}`;
  if (WEAPON_IMG[it.key]) return it.key;
  const tier = weaponTierArt(t, it.rar ?? (typeof ITEMS !== 'undefined' && ITEMS[it.key] ? ITEMS[it.key].rar : 0));
  return tier || (t && WEAPON_IMG[t] ? t : null);
}
// 普通武器按品级换外观：稀有 / 神器 / 传说 = <类型>_r2 / r3 / r4（没有专属图的史诗用传说外观）；普通 / 高级用基础外观
function weaponTierArt(t, rar) {
  const r = Math.min(rar | 0, 4);
  return t && r >= 2 && WEAPON_IMG[`${t}_r${r}`] ? `${t}_r${r}` : null;
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
   2. 身体（可以混搭，官方同款）：上身（头 + 躯干 + 手臂）按上衣那套画，下身按下装那套，脚按鞋那套；没穿的部位是职业默认造型。
      躺地 / 缩成一团等拼不了的动作帧，整个人按身体部位（上衣 / 下装 / 胸部 / 腰带 / 鞋）里件数最多的那一套画（lookBodySet）。
   3. 帽子 / 头部 / 脸部：单独叠加在头上；职业默认造型自带帽子（神枪手的报童帽、魔法师的巫师帽）时，帽子和发饰只在上身换成时装后显示。 */
const AVATAR_HAT_CLS = { gun: 1, mage: 1 };   // 默认造型自带帽子的职业
// 某件时装对应的帧集 id（这个职业有这套帧才算）
const avatarSetOf = (cls, it) => { const S = it && it.set && AVATAR_SETS[it.set]; return S && SPR_DATA[`${cls}@${S.id}`] ? S.id : null; };
/* 混搭（官方同款：每个部位显示自己那套）：上身（头 + 躯干 + 手臂）= 上衣那套，下身 = 下装那套，脚 = 鞋那套；没穿的部位用职业默认造型。
   三段都一样（或都没穿）→ parts = null，照旧整套换帧（上衣 / 下装 / 鞋都是同一套才整套换；只穿上衣 = 时装上身 + 默认下身）。
   每帧的分割线在原装 spr.json 的 F.cut（art/tools/avatar_cuts.py）；没有分割线的帧整套用 lookBodySet 选出的那套（look.set）。
   上衣 / 下装 / 鞋都没穿时 parts = null，身体按 lookBodySet（例如神枪手 / 魔法师只戴时装帽子 → 整套换成那套，帽子才显示得出来）。 */
function avatarParts(cls, eq) {
  const up = avatarSetOf(cls, eq.av_top), low = avatarSetOf(cls, eq.av_bottom), feet = avatarSetOf(cls, eq.av_shoes);
  return up === low && low === feet ? null : { up, low, feet };
}
const AV_BODY_SLOTS = ['av_top', 'av_bottom', 'av_chest', 'av_belt', 'av_shoes'];
function lookBodySet(cls, eq, prefer) {
  const P = prefer && AVATAR_SETS[prefer]; if (P && SPR_DATA[`${cls}@${P.id}`]) return P.id;   // 商城试穿：正在试的那套优先
  const setOf = slot => { const it = eq[slot], S = it && it.set && AVATAR_SETS[it.set]; return S && SPR_DATA[`${cls}@${S.id}`] ? S.id : null; };
  // 身体部位决定整体造型：件数多的优先，同样多时比头部配件件数，再比上衣 > 下装
  const score = {};
  for (const slot of AV_BODY_SLOTS) { const id = setOf(slot); if (!id) continue; const s = score[id] = score[id] || [0, 0, 0]; s[0]++; if (slot === 'av_top') s[2] += 2; if (slot === 'av_bottom') s[2] += 1; }
  for (const slot of ['av_hat', 'av_hair', 'av_face']) { const id = setOf(slot); if (id && score[id]) score[id][1]++; }
  const better = (a, b) => { for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i]; return false; };
  let best = null; for (const id in score) if (!best || better(score[id], score[best])) best = id;
  if (best) return best;
  // 没穿身体部位：默认造型自带帽子的职业戴了时装帽子 / 发饰 → 换成那套，帽子才显示得出来（只戴眼镜不换）
  return AVATAR_HAT_CLS[cls] ? setOf('av_hat') || setOf('av_hair') : null;
}
// 这套装备是谁的：当前角色 → game.job；存档里的其他角色（选角界面）→ 那个角色的 job；其他 → null
function lookJobOf(eq) {
  if (typeof inv !== 'undefined' && eq === inv.equip) return typeof game !== 'undefined' ? game.job || null : null;
  const d = typeof save !== 'undefined' && save.chars && save.chars.find(c => c && c.equip === eq);
  return d ? d.job || null : null;
}
// look.job：转职外观（content/avatar/job_looks.js）；联机时随 look 一起发给其他玩家
function lookFromEquip(cls, eq, prefer, job) {
  eq = eq || {}; if (job === undefined) job = lookJobOf(eq);
  const set = lookBodySet(cls, eq, prefer), parts = prefer ? null : avatarParts(cls, eq), upCostume = parts ? !!parts.up : !!set;   // 商城试穿（prefer）整套看
  const acc = [];
  for (const slot of ['av_hat', 'av_hair', 'av_face']) {
    const it = eq[slot]; if (!it || !AVATAR_ACC[it.key]) continue;
    if (slot !== 'av_face' && AVATAR_HAT_CLS[cls] && !upCostume) continue;   // 默认上身自带帽子：上身换成时装后才显示帽子 / 发饰
    acc.push(it.key);
  }
  return { wpn: weaponArtOf(eq.weapon, cls, eq.av_weapon), set, parts, acc: jobLookAcc(job, acc), glow: vanityGlowOf(eq.weapon), job: job || null };   // glow：强化 / 增幅光效（game/vanity.js）
}
// 职业默认外观（选角立绘、路人、决斗场对手等没有装备信息的模型）
function defaultLook(cls) {
  const t = typeof CLASS_START_WEAPON !== 'undefined' ? CLASS_START_WEAPON[cls] : null;
  return { wpn: t && WEAPON_IMG[t] ? t : null, set: null, acc: [] };
}
// 路人冒险家：随机武器（偶尔史诗）+ 一定几率穿时装
function avatarRandomLook(cls) {
  const types = Object.keys(WEAPON_IMG).filter(k => WEAPON_IMG[k].type && typeof WTYPES !== 'undefined' && WTYPES[WEAPON_IMG[k].type] && WTYPES[WEAPON_IMG[k].type].cls === cls);
  const base = types.filter(k => k === WEAPON_IMG[k].type || /_r[234]$/.test(k)), ep = types.filter(k => k.startsWith('ep_'));
  const wpn = ep.length && Math.random() < 0.2 ? pick(ep) : base.length ? pick(base) : defaultLook(cls).wpn;
  const sets = Object.values(AVATAR_SETS).filter(S => SPR_DATA[`${cls}@${S.id}`]);
  const set = sets.length && Math.random() < 0.35 ? pick(sets).id : null;
  const acc = set ? Object.keys(AVATAR_ACC).filter(k => k.endsWith('_' + set) && Math.random() < 0.6) : [];
  // 穿时装的路人里约三分之一是混搭（上衣 / 下装 / 鞋各挑一套，可能有一段是默认造型）
  const parts = set && sets.length > 1 && Math.random() < 0.33 ? { up: set, low: pick(sets).id, feet: Math.random() < 0.3 ? null : pick(sets).id } : null;
  return { wpn, set, parts: parts && !(parts.up === parts.low && parts.low === parts.feet) ? parts : null, acc };
}
