/* =====================================================================
   物品库 · 经典官方史诗武器（武器外观组）：每种武器补 1~2 件玩家最熟悉的官方史诗，镇馆之宝是巨剑「魔剑-阿波菲斯」
   名字、原型来自国服（desc 括号里注明官方出处）；等级按本作 Lv1~30 段压缩，数值是同等级史诗的平替（不是新的毕业装备）。
   外观：art/final/weapon/<key>.webp（art/tools/avatar_gen.py 的 BOLD_EPICS）；掉落：content/items/droptables.js 末尾 + 普通随机史诗 / 深渊派对
   ===================================================================== */
{
const EP = (key, def) => defineEpic(key, { slot: 'weapon', ...def });
/* ---------------- 鬼剑士 ---------------- */
EP('ep_gs_apophis', { wtype: 'greatsword', lvl: 27, name: '魔剑-阿波菲斯', fx: { dmgUp: 0.09, dark: 25, atkElem: 'dark', hardness: 20 },
  proc: [{ chance: 0.05, cd: 1, act: 'strike', mul: 1.8, aoe: 140, elem: 'dark', vis: 'dark', col: '#c0304a', name: '魔剑吞噬！', desc: '暗属性攻击；攻击时 5% 几率释放魔剑之力：对周围敌人造成 180% 暗属性伤害，' },
    { on: 'kill', chance: 0.25, act: 'heal', hp: 0.02, desc: '击杀敌人时 25% 几率吞噬灵魂，恢复 2% HP。' }],
  desc: '被诅咒的魔剑，只有精神足够强大、不被反噬的人才能驾驭。（官方：悲鸣洞穴特产的 Lv55 神器巨剑，外观风靡多年；进化后为 Lv74 史诗「真·魔剑-阿波菲斯」）' });
EP('ep_gs_conqueror', { wtype: 'greatsword', lvl: 21, name: '征服者之翼', fx: { dmgUp: 0.07, stagger: 30, mspd: 0.04 },
  proc: { on: 'kill', chance: 0.3, cd: 8, act: 'buff', buff: { aspd: 0.1, mspd: 0.1 }, dur: 6, key: 'conqueror', name: '征服者之翼', col: '#ffd070', desc: '击杀敌人时 30% 几率展开征服者之翼：6 秒内攻击 / 移动速度 +10%（冷却 8 秒）。' },
  desc: '剑身像一只收拢的巨翼，挥下时羽刃层层展开。（官方 Lv50 史诗巨剑）' });
EP('ep_kt_meteor', { wtype: 'katana', lvl: 24, name: '流光星陨刀', fx: { fire: 22, atkElem: 'fire', crit: 0.03, mcrit: 0.03, aspd: 0.03 },
  proc: { on: 'crit', chance: 0.1, cd: 2, act: 'strike', mul: 1.6, aoe: 110, elem: 'fire', vis: 'fire', name: '流星坠落！', desc: '火属性攻击；暴击时 10% 几率召唤流星：对周围敌人造成 160% 火属性伤害（冷却 2 秒）。' },
  desc: '刀身像一片夜空，刀刃上却燃着流星的火光。（官方经典火属性史诗太刀）' });
EP('ep_ls_breaker', { wtype: 'lightsaber', lvl: 18, name: '聚光剑-破幻者', fx: { light: 20, aspd: 0.05, hit: 0.03 },
  proc: { chance: 0.06, act: 'debuff', taken: 0.1, dur: 5, name: '破幻', desc: '攻击时 6% 几率破除敌人的护体幻象：5 秒内受到的伤害 +10%。' },
  desc: '把光聚成一点，能刺穿一切幻术。（官方 Lv50 史诗光剑）' });
EP('ep_ss_gsd', { wtype: 'shortsword', lvl: 19, name: 'G.S.D的究极波动刃', st: { int: 24 }, fx: { cdr: 0.05, dmgUp: 0.05 },
  proc: { on: 'skill', chance: 0.1, cd: 3, act: 'strike', mul: 1.4, aoe: 140, vis: 'nova', col: '#7fe0ff', name: '波动爆发！', desc: '施放技能时 10% 几率引发波动爆发：对周围敌人造成 140% 伤害（冷却 3 秒）。' },
  desc: '剑圣 G.S.D 亲手打造的波动之刃，挥动时空气会一圈圈荡开。（官方 Lv50 史诗短剑）' });
EP('ep_cb_ghost', { wtype: 'club', lvl: 20, name: '恶鬼噬魂槌', fx: { stagger: 40, dark: 18, hpPct: 0.05 },
  proc: { on: 'kill', chance: 0.3, act: 'heal', hp: 0.03, name: '噬魂', desc: '击杀敌人时 30% 几率吞噬灵魂，恢复 3% HP。' },
  desc: '槌头是一只恶鬼的头骨，据说夜里还会咬牙。（官方 Lv50 史诗钝器）' });
/* ---------------- 神枪手 ---------------- */
EP('ep_rv_enazma', { wtype: 'revolver', lvl: 23, name: '双刃左轮-艾娜兹玛', fx: { crit: 0.04, mcrit: 0.04, dmgUp: 0.06 },
  proc: { chance: 0.06, act: 'status', status: 'bleed', dur: 4, dps: 0.08, name: '双刃撕裂', desc: '攻击时 6% 几率使敌人出血 4 秒。' },
  desc: '枪管上下各装一片弯刃，贴身也能把敌人撕开。（官方 Lv55 史诗左轮枪）' });
EP('ep_ap_flash', { wtype: 'autopistol', lvl: 19, name: '枪械之神-闪', fx: { aspd: 0.07, mspd: 0.05, crit: 0.02, mcrit: 0.02 },
  proc: { on: 'crit', chance: 0.08, cd: 10, act: 'buff', buff: { aspd: 0.1 }, dur: 5, key: 'flash', name: '闪！', col: '#9fe3ff', desc: '暴击时 8% 几率进入“闪”状态：5 秒内攻击速度 +10%（冷却 10 秒）。' },
  desc: '被称作“枪械之神”的传奇枪匠的作品，快得只剩一道闪光。（官方 Lv55 史诗自动手枪）' });
EP('ep_rf_howl', { wtype: 'rifle', lvl: 20, name: '戾啸之游离锍', fx: { critDmg: 0.15, dmgUp: 0.05, stagger: 20 },
  proc: { chance: 0.05, act: 'status', status: 'stun', dur: 1, name: '戾啸', desc: '攻击时 5% 几率用枪声震慑敌人（眩晕 1 秒）。' },
  desc: '开火时枪口会发出狼一样的啸声。（官方 Lv55 史诗步枪）' });
EP('ep_hc_meteor', { wtype: 'handcannon', lvl: 21, name: '爆弹双陨星', fx: { fire: 20, stagger: 40, dmgUp: 0.06 },
  proc: { chance: 0.05, cd: 1.5, act: 'strike', mul: 1.5, aoe: 140, elem: 'fire', vis: 'fire', name: '双陨星！', desc: '攻击时 5% 几率引爆双陨星：对周围敌人造成 150% 火属性伤害（冷却 1.5 秒）。' },
  desc: '两根炮管同时开火，像两颗陨星一起坠地。（官方 Lv55 史诗手炮）' });
EP('ep_bg_headless', { wtype: 'bowgun', lvl: 12, name: '无头之魂', fx: { aspd: 0.05, dark: 15, crit: 0.02, mcrit: 0.02 },
  desc: '无头骑士留下的手弩，弩臂像一件破烂的披风。（官方 Lv50 史诗手弩，暮色之城的无头骑士掉落）' });
EP('ep_bg_lotus', { wtype: 'bowgun', lvl: 26, name: '冰火之莲', fx: { fire: 18, ice: 18, aspd: 0.05, dmgUp: 0.07 },
  proc: [{ chance: 0.04, act: 'status', status: 'burn', dur: 3, dps: 0.1, name: '灼伤', desc: '攻击时 4% 几率使敌人灼伤 3 秒，' },
    { chance: 0.04, act: 'status', status: 'freeze', dur: 1.2, name: '冰冻', desc: '4% 几率冰冻敌人 1.2 秒。' }],
  desc: '一半是冰、一半是火的莲花手弩。（官方 Lv85 史诗手弩）' });
/* ---------------- 魔法师 ---------------- */
EP('ep_sp_icedragon', { wtype: 'spear', lvl: 20, name: '冰龙掩日矛', fx: { ice: 22, atkElem: 'ice', stagger: 30, dmgUp: 0.05 },
  proc: { chance: 0.05, act: 'status', status: 'freeze', dur: 1.2, name: '冰封', desc: '冰属性攻击；攻击时 5% 几率冰冻敌人 1.2 秒。' },
  desc: '冰龙的鳍化成了矛刃，挥动时连太阳都会暗下来。（官方史诗矛）' });
EP('ep_pl_magical', { wtype: 'pole', lvl: 25, name: '爱之闪耀魔法少女棒', fx: { cspd: 0.06, aspd: 0.04, dmgUp: 0.07, light: 18 },
  proc: { on: 'crit', chance: 0.1, cd: 2, act: 'strike', mul: 1.5, aoe: 120, elem: 'light', vis: 'petal', col: '#ffb3d9', name: '爱之闪耀！', desc: '暴击时 10% 几率释放爱心光波：对周围敌人造成 150% 光属性伤害（冷却 2 秒）。' },
  desc: '以爱与正义之名战斗的魔法少女专用战棍。（官方 Lv85 史诗棍棒）' });
EP('ep_rd_thunder', { wtype: 'rod', lvl: 22, name: '雷芒之典', fx: { light: 22, atkElem: 'light', cspd: 0.05, cdr: 0.04 },
  proc: { on: 'skill', chance: 0.08, cd: 2, act: 'strike', mul: 1.5, elem: 'light', vis: 'bolt', name: '雷芒！', desc: '光属性攻击；施放技能时 8% 几率降下雷芒（150% 光属性伤害，冷却 2 秒）。' },
  desc: '杖头是一本写满雷系咒文的魔典。（官方 Lv55 史诗魔杖）' });
EP('ep_st_witchgold', { wtype: 'staff', lvl: 23, name: '女巫的黄金法杖', fx: { mcrit: 0.04, crit: 0.02, dmgUp: 0.06, goldUp: 0.08 },
  desc: '女巫用黄金铸成的法杖，据说连好运也能一起召来。（官方 Lv65 史诗法杖）' });
EP('ep_br_hunter', { wtype: 'broom', lvl: 18, name: '猎捕者的鬼面扫把', fx: { mspd: 0.06, cspd: 0.05, dark: 15 },
  proc: { chance: 0.05, act: 'status', status: 'slow', dur: 3, name: '鬼面', desc: '攻击时 5% 几率用鬼面吓住敌人（减速 3 秒）。' },
  desc: '扫把上挂着一张鬼面具，专门吓唬猎物。（官方史诗扫把）' });
}
