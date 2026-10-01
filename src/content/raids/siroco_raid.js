/* =====================================================================
   希洛克攻坚战 · RA3 节点地下城
   团本规则核心只保存节点关系；这里把每个节点落成真正的地下城，避免客户端把节点临时映射到普通副本。
   节点共用希洛克区域已有的怪物和主题，美术 / 机制沿用对应领主定义；raid:true 由 Dungeon 与组队入口识别。
   ===================================================================== */
const SIROCO_RAID_BOSSES = [
  ['haniel', 'assassin', '魅惑之哈妮尔'], ['lena', 'luxi', '狙击手莱娜'], ['gusty', 'gazer', '贪食的古斯提'],
  ['grumi', 'gazer', '漂流的古鲁米'], ['vita', 'nex', '慈悲之维塔'], ['siroNightmare', 'siroco', '希洛克的噩梦'],
  ['siroPhantom', 'siroco', '希洛克的幻影'], ['crone', 'voidCaster', '梦中老妪'],
];
for (const [id, base, name] of SIROCO_RAID_BOSSES) if (!MON[id] && MON[base]) { MON[id] = { ...MON[base], name }; MON_ART[id] = [...MON_ART[base]]; }
const SIROCO_RAID_COMMON = {
  raid: true, hidden: true, layout: 'raid', branches: 1, cols: 5, rows: 3, rooms: 5, bossAdds: 0,
  lvl: [62, 63], clearExp: 0, bgm: 'dungeon', bossBgm: 'boss',
};
const SIROCO_RAID_MOBS = {
  law: [['phantomBlade', 3], ['hellHound', 2], ['voidCaster', 2], ['burstShade', 1]],
  wit: [['phantomStalker', 3], ['voidCaster', 2], ['soulBinder', 2], ['gazer', 1.5]],
  pain: [['jailer', 2], ['hellHound', 2], ['burstShade', 2], ['gazer', 1.5], ['phantomBlade', 1]],
  coffin: [['phantomStalker', 2], ['soulBinder', 1.5], ['gazer', 1.5], ['jailer', 1], ['burstShade', 1]],
};
const defineSirocoRaid = (id, name, theme, mobs, elite, boss, extra = {}) => defineDungeon(id, {
  ...SIROCO_RAID_COMMON, ...extra, id, name, theme, mobs: SIROCO_RAID_MOBS[mobs] || mobs, elite, boss: { kind: boss, lvl: extra.bossLvl || 64 },
  desc: `【希洛克攻坚】${name}。团本节点专用地图，不消耗疲劳。`,
});

defineSirocoRaid('raid_si_law', '破坏之门', 'siroLaw', 'law', 'jailer', 'gatekeeper', { rooms: 4, branches: 0, bossLvl: 62 });
defineSirocoRaid('raid_si_dawn', '梦幻之黎明', 'siroWit', 'wit', 'soulBinder', 'haniel', { rooms: 4, branches: 1, bossLvl: 62 });
defineSirocoRaid('raid_si_night', '噩梦之夜', 'siroWit', 'wit', 'gazer', 'lena', { rooms: 3, branches: 0, bossLvl: 62 });
defineSirocoRaid('raid_si_memory', '记忆的碎片', 'siroPain', 'pain', 'jailer', 'gusty', { rooms: 4, branches: 1, bossLvl: 63 });
defineSirocoRaid('raid_si_mirror', '痛苦之镜', 'siroPain', 'pain', 'burstShade', 'grumi', { rooms: 3, branches: 0, bossLvl: 63 });
defineSirocoRaid('raid_si_gate_l', '无形之门·左', 'siroLaw', 'law', 'jailer', 'vita', { rooms: 4, branches: 1, bossLvl: 63 });
defineSirocoRaid('raid_si_gate_r', '无形之门·右', 'siroLaw', 'law', 'jailer', 'nex', { rooms: 4, branches: 1, bossLvl: 63 });
defineSirocoRaid('raid_si_gate_duo', '无形之门', 'siroLaw', 'law', 'jailer', 'vita', { rooms: 5, branches: 1, bossLvl: 63 });
defineSirocoRaid('raid_si_sub', '潜意识之厅', 'siroCoffin', 'coffin', 'soulBinder', 'siroNightmare', { rooms: 4, branches: 0, bossLvl: 63 });
defineSirocoRaid('raid_si_con', '意识之厅', 'siroCoffin', 'coffin', 'jailer', 'siroPhantom', { rooms: 5, branches: 1, bossLvl: 63 });
defineSirocoRaid('raid_si_mutant', '变异的潜意识之厅', 'siroPain', 'pain', 'gazer', 'crone', { rooms: 4, branches: 0, bossLvl: 63 });
defineSirocoRaid('raid_si_coffin', '真·意识之棺', 'siroCoffin', 'coffin', 'jailer', 'siroco', { rooms: 6, branches: 1, lvl: [63, 64], bossLvl: 64, bgm: 'abyss' });
