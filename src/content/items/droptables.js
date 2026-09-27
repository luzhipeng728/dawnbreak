/* =====================================================================
   掉落表：按地下城（DUNGEONS 的 id）配置领主专属掉落和材料掉落
   defineDropTable(id, { boss: [[物品 key, 几率, 数量?]...], mats: [[key, 几率（普通怪）, 数量]...] })
   - 领主几率会乘上难度加成（冒险 / 勇士 / 王者 更高）；材料几率精英 ×2、领主 ×4
   - 通用的随机装备掉落（品级按难度）在 drops.js 的 rollDrop 里，不需要在这里写
   ===================================================================== */
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
