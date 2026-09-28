/* =====================================================================
   掉落表：按地下城（DUNGEONS 的 id）配置领主专属掉落和材料掉落
   defineDropTable(id, { boss: [[物品 key, 几率, 数量?]...], mats: [[key, 几率（普通怪）, 数量]...] })
   - 领主几率会乘上难度加成（冒险 / 勇士 / 王者 更高）；材料几率精英 ×2、领主 ×4
   - 通用的随机装备掉落（品级按难度）在 drops.js 的 rollDrop 里，不需要在这里写
   ===================================================================== */
{   // 局部常量放进块作用域
const setDrops = (ids, p) => ids.flatMap(id => SETS[id].pieces.map(k => [k, p]));
const NOVICE = setDrops(['set_goblin'], 0.035);
const CLASS12 = setDrops(['set_knight', 'set_sage', 'set_hunter'], 0.025);
const ADV18 = setDrops(['set_balk', 'set_gabis'], 0.03);
const ADV22 = setDrops(['set_rex', 'set_titan'], 0.012);
const THRONE = setDrops(['set_throne'], 0.04);
const ELF16 = setDrops(['set_elf'], 0.04);
const BASIC_MATS = [['crystal', 0.05, 3], ['m_cloth', 0.02, 1], ['m_iron', 0.02, 1]];
defineDropTable('lorien', { boss: [['title_goblin', 0.03]], mats: BASIC_MATS });
defineDropTable('lorien_deep', { boss: [...NOVICE], mats: BASIC_MATS });
defineDropTable('dark_woods', { boss: [...NOVICE, ['ep_shoes', 0.012]], mats: [...BASIC_MATS, ['m_leather', 0.02, 1]] });
defineDropTable('dark_woods_deep', { boss: [...NOVICE, ['ep_shoes', 0.015], ['ep_top', 0.01]], mats: [...BASIC_MATS, ['m_bone', 0.02, 1]] });
defineDropTable('thunder_ruins', { boss: [['ep_top', 0.012], ['ep_katana', 0.008], ['ep_revolver', 0.008], ['ep_staff', 0.008]], mats: [['crystal', 0.06, 4], ['c_white', 0.02, 1], ['m_iron', 0.02, 2]] });
defineDropTable('venom_ruins', { boss: [...CLASS12, ['ep_neck', 0.01], ['ep_ring', 0.008]], mats: [['crystal', 0.06, 4], ['c_black', 0.02, 1], ['m_bone', 0.02, 2]] });
defineDropTable('frozen_woods', { boss: [...CLASS12, ['ep_head', 0.015], ['ep_neck', 0.012], ['ep_shortsword', 0.01]], mats: [['crystal', 0.07, 5], ['c_blue', 0.03, 1], ['m_elem', 0.01, 1]] });
defineDropTable('graca', { boss: [...CLASS12, ['ep_club', 0.01], ['ep_bracelet', 0.01], ['ep_lightsaber', 0.008]], mats: [['crystal', 0.07, 5], ['m_leather', 0.03, 2], ['m_elem', 0.01, 1]] });
defineDropTable('blazing_graca', { boss: [...ELF16, ...CLASS12, ...THRONE, ['ep_bracelet', 0.012], ['ep_bowgun', 0.008], ['ep_shoes2', 0.01], ['ep_shortsword', 0.008]], mats: [['crystal', 0.08, 6], ['c_red', 0.03, 1], ['m_elem', 0.012, 1]] });
defineDropTable('dark_thunder', { boss: [...ADV18, ...ADV22, ...ELF16, ...THRONE, ['ep_greatsword', 0.01], ['ep_handcannon', 0.01], ['ep_rod', 0.01], ['ep_katana2', 0.008], ['ep_head2', 0.008], ['ep_lightsaber', 0.006], ['ep_broom', 0.006], ['ep_stone', 0.01], ['ep_support', 0.01], ['title_slayer', 0.02]], mats: [['crystal', 0.08, 6], ['c_black', 0.03, 2], ['m_elem', 0.015, 1], ['m_elem2', 0.004, 1], ['m_obsidian', 0.004, 1], ['m_diamond', 0.003, 1]] });
/* ---- 天空之城（地下城内容组，Lv14~24） ---- */
const SKY24 = setDrops(['set_sky', 'set_dragonkin', 'set_skyranger'], 0.025), SEGHART = setDrops(['set_seghart'], 0.03);
defineDropTable('dragon_tower', { boss: [...ADV18, ...ELF16, ['ep_bowgun', 0.01], ['ep_shoes2', 0.01], ['ep_ring', 0.008]], mats: [['crystal', 0.08, 6], ['m_leather', 0.03, 2], ['m_elem', 0.012, 1]] });
defineDropTable('puppet_hall', { boss: [...ADV18, ...ELF16, ...THRONE, ['ep_head', 0.01], ['ep_shortsword', 0.01], ['ep_bracelet', 0.008]], mats: [['crystal', 0.08, 6], ['c_white', 0.03, 2], ['m_elem', 0.012, 1]] });
defineDropTable('golem_tower', { boss: [...ADV18, ...THRONE, ['ep_greatsword', 0.01], ['ep_handcannon', 0.01], ['ep_club', 0.01], ['ep_top', 0.008]], mats: [['crystal', 0.08, 7], ['m_iron', 0.03, 2], ['m_diamond', 0.004, 1]] });
defineDropTable('dark_corridor', { boss: [...ADV22, ...THRONE, ['ep_katana2', 0.01], ['ep_head2', 0.01], ['ep_lightsaber', 0.01], ['ep_broom', 0.01], ['ep_stone', 0.008]], mats: [['crystal', 0.09, 7], ['c_black', 0.03, 2], ['m_obsidian', 0.005, 1]] });
defineDropTable('lord_palace', { boss: [...ADV22, ...SKY24, ...SEGHART, ['ep_support', 0.01], ['ep_autopistol', 0.008], ['ep_rifle', 0.008], ['ep_spear', 0.008], ['ep_pole', 0.008], ['ep_ring2', 0.008], ['ep_neck2', 0.008]], mats: [['crystal', 0.1, 8], ['m_elem2', 0.006, 1], ['m_soul', 0.001, 1]] });
defineDropTable('floating_castle', { boss: [...SKY24.map(([k, p]) => [k, p * 1.5]), ...SEGHART.map(([k, p]) => [k, p * 1.5]), ['ep_autopistol', 0.012], ['ep_rifle', 0.012], ['ep_spear', 0.012], ['ep_pole', 0.012], ['ep_ring2', 0.012], ['ep_neck2', 0.012], ['ep_stone', 0.01], ['ep_support', 0.01]], mats: [['crystal', 0.1, 8], ['m_diamond', 0.006, 1], ['m_elem2', 0.008, 1]] });
/* ---- 装备深化：新史诗放进对应等级段的领主掉落表（按官方的“某个领主掉某件史诗”的感觉；几率和原有史诗一样约 1%） ---- */
const addBoss = (id, list) => { const T = DROP_TABLES[id]; if (T) T.boss.push(...list); };
addBoss('thunder_ruins', [['ep_head_campaign', 0.01], ['ep_rd_cheshire', 0.008]]);
addBoss('venom_ruins', [['ep_bottom_tiger', 0.01], ['ep_pl_grian', 0.008], ['ep_br_scribble', 0.008]]);
addBoss('frozen_woods', [['ep_shoes_sky', 0.012], ['ep_gs_earth', 0.01], ['ep_ring_ice', 0.008]]);
addBoss('graca', [['ep_ls_sun', 0.01], ['ep_ap_viper', 0.01], ['ep_sp_evil', 0.01]]);
addBoss('blazing_graca', [['ep_kt_slaughter', 0.008], ['ep_rf_death', 0.008], ['ep_belt_oath', 0.008], ['ep_sup_michel', 0.008]]);
addBoss('dark_thunder', [['ep_cb_devour', 0.01], ['ep_head_skull', 0.01], ['ep_ring_devour', 0.008], ['ep_shoes_rabina', 0.008]]);
addBoss('dragon_tower', [['ep_ring_ice', 0.01], ['ep_belt_oath', 0.008]]);
addBoss('puppet_hall', [['ep_cb_devour', 0.01], ['ep_shoes_rabina', 0.01]]);
addBoss('golem_tower', [['ep_stone_platani', 0.03], ['ep_head_skull', 0.008]]);
addBoss('dark_corridor', [['ep_rv_sunset', 0.01], ['ep_st_willy', 0.01], ['ep_pl_breaker', 0.01], ['ep_neck_hunter', 0.008], ['ep_brace_wave', 0.008]]);
addBoss('lord_palace', [['ep_top_hes', 0.01], ['ep_bottom_hes', 0.01], ['ep_ss_kanya', 0.008], ['ep_cb_soulmate', 0.008], ['ep_bg_red', 0.008], ['ep_ring_fire', 0.008]]);
addBoss('floating_castle', [['ep_gs_evildragon', 0.01], ['ep_hc_breaker', 0.01], ['ep_shoes_pisco', 0.01], ['ep_belt_storm', 0.01], ['ep_head_jeno', 0.008], ['ep_top_hes', 0.008], ['ep_bottom_hes', 0.008]]);
/* ---- 经典官方史诗武器（epics3.js）：按等级段放进领主表；魔剑-阿波菲斯在天帷巨兽最后两张图 ---- */
addBoss('frozen_woods', [['ep_bg_headless', 0.01]]);
addBoss('golem_tower', [['ep_ls_breaker', 0.01], ['ep_br_hunter', 0.01]]);
addBoss('dark_thunder', [['ep_ss_gsd', 0.008], ['ep_ap_flash', 0.008]]);
addBoss('dark_corridor', [['ep_cb_ghost', 0.01], ['ep_rf_howl', 0.01], ['ep_sp_icedragon', 0.01]]);
addBoss('lord_palace', [['ep_gs_conqueror', 0.008], ['ep_hc_meteor', 0.008], ['ep_rd_thunder', 0.008]]);
addBoss('floating_castle', [['ep_rv_enazma', 0.01], ['ep_st_witchgold', 0.01], ['ep_kt_meteor', 0.01]]);
/* ---- 天帷巨兽（地下城内容组，Lv24~30）：Lv25~27 的单件史诗 + 天帷巨兽名品（传说，每件只在一个领主身上）；区域没加载时这些表不会被用到 ---- */
defineDropTable('temple_outskirts', { boss: [...SKY24, ['lg_fan_robe', 0.02], ['ep_head_jeno', 0.01], ['ep_kt_andra', 0.008], ['ep_st_sage', 0.008]], mats: [['crystal', 0.1, 8], ['c_white', 0.03, 2], ['m_soul', 0.001, 1]] });   // GBL教大主教：梵风衣
defineDropTable('treant_jungle', { boss: [...SKY24, ['lg_light_dance', 0.02], ['ep_ls_millennium', 0.008], ['ep_rv_bone', 0.008], ['ep_sup_paris', 0.008]], mats: [['crystal', 0.1, 8], ['m_leather', 0.03, 2], ['m_elem2', 0.006, 1]] });   // 罗丁：光之舞手镯
defineDropTable('purgatory', { boss: [...SEGHART, ['ep_ss_fate', 0.01], ['ep_cb_kirin', 0.01], ['ep_hc_aqua', 0.01], ['ep_rd_meow', 0.008]], mats: [['crystal', 0.11, 9], ['c_red', 0.03, 2], ['m_obsidian', 0.006, 1]] });   // 夜叉王：单件史诗与套装
defineDropTable('polar_day', { boss: [...SEGHART, ['lg_holy_pendant', 0.02], ['ep_rd_meow', 0.008], ['ep_br_lucky', 0.008], ['ep_head_jeno', 0.008]], mats: [['crystal', 0.11, 9], ['m_elem2', 0.01, 1]] });   // 多尼尔（EX）：圣灵战士项坠
defineDropTable('second_spine', { boss: [['lg_sage_ring', 0.02], ['ep_kt_andra', 0.008], ['ep_ls_millennium', 0.008], ['ep_rv_bone', 0.008], ['ep_st_sage', 0.008], ['ep_ss_fate', 0.008], ['ep_cb_kirin', 0.008], ['ep_br_lucky', 0.008]], mats: [['crystal', 0.12, 10], ['m_diamond', 0.008, 1], ['c_blue', 0.03, 2]] });   // 长脚罗特斯：贤者之戒
defineDropTable('forbidden_land', { boss: [['lg_karo_eye', 0.025], ['ep_hc_aqua', 0.01], ['ep_sup_paris', 0.01], ['ep_head_jeno', 0.01], ['ep_ls_millennium', 0.01]], mats: [['crystal', 0.12, 10], ['c_white', 0.03, 2], ['m_soul', 0.002, 1]] });   // 审判者马塞尔：卡罗蛇眼
// 经典官方史诗武器（epics3.js）的天帷巨兽段
addBoss('temple_outskirts', [['ep_pl_magical', 0.008]]);
addBoss('treant_jungle', [['ep_bg_lotus', 0.008]]);
addBoss('second_spine', [['ep_gs_apophis', 0.008]]);
addBoss('forbidden_land', [['ep_gs_apophis', 0.01]]);
/* ---- 深渊派对的领主掉落表（专属史诗由 content/abyss.js 按几率另外掷；这里只放普通的套装部件） ---- */
defineDropTable('abyss_gf', { boss: [...ADV18.map(([k, p]) => [k, p * 1.5]), ...ELF16, ...THRONE], mats: [['crystal', 0.1, 8], ['m_elem', 0.02, 1], ['m_elem2', 0.006, 1]] });
defineDropTable('abyss_sky', { boss: [...SKY24.map(([k, p]) => [k, p * 1.5]), ...SEGHART.map(([k, p]) => [k, p * 1.5])], mats: [['crystal', 0.12, 10], ['m_elem2', 0.01, 1], ['m_diamond', 0.008, 1]] });
// 天帷巨兽的深渊（区域没加载时这两张深渊不存在，表不会被用到）：城主秘宝首饰 + 天帷巨兽名品；专属史诗照常由 content/abyss.js 另外掷
defineDropTable('abyss_spine', { boss: [...SEGHART.map(([k, p]) => [k, p * 1.5]), ['lg_sage_ring', 0.03], ['lg_holy_pendant', 0.02], ['lg_light_dance', 0.02]], mats: [['crystal', 0.12, 10], ['m_diamond', 0.01, 1], ['m_elem2', 0.012, 1]] });
defineDropTable('abyss_forbidden', { boss: [...SEGHART.map(([k, p]) => [k, p * 1.5]), ['lg_karo_eye', 0.035], ['lg_fan_robe', 0.02], ['lg_sage_ring', 0.02]], mats: [['crystal', 0.12, 10], ['m_soul', 0.003, 1], ['m_diamond', 0.01, 1]] });
}
