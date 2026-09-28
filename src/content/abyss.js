/* =====================================================================
   深渊派对（装备深化）：官方刷史诗的核心玩法。每个区域在 spec 里写一个 abyss 块就有自己的深渊（docs/REGION_PIPELINE.md §2.1）
   - 区域 spec：abyss: { <地下城 id>: { name, lvl, lordLvl, lords, gate, quest, cost, pity, waves, lord, ... } }；spec.items 里标了 abyss 的史诗 / 套装 = 这个区域的深渊专属
     老区域（格兰之森 / 天空之城 / 天帷巨兽）没有 spec，写在下面的 ABYSS_LEGACY 里，格式相同；这个文件在所有区域 spec 之后加载，统一展开
   - 进入：消耗 cost 张「深渊派对邀请函」；地下城门在歌兰蒂斯的资格任务完成后出现（隐藏门的现身特效，world.js revealGate）
   - 深渊之间（领主房）：先打破「封印之门」（血量过半时出现堕落守护者）→ 按 waves 配置的几波深渊派对 → 深渊领主降临（每次随机，带领主机制库里的机制）
   - 掉落：深渊领主 / 堕落守护者 / 深渊精英有史诗几率（一半出本区域的深渊专属），金色光柱 + 紫色光环；保底：连续 pity-1 次没出史诗，第 pity 次领主必掉
     通关后结算界面多一排「深渊宝藏」翻牌（宇宙灵魂 / 矛盾的结晶体 / 邀请函 / 异界精髓 / 史诗）
   - 普通地下城的额外掉落也在这里：深渊派对邀请函、怪物卡片、矛盾的结晶体、强烈的气息（abyssExtraDrops，由 drops.js 的 rollDrop 调用）
   - 组队（联机组）：掉落各拿各的（每个客户端各自 rollDrop）；深渊派对的刷怪只在主机上跑（netIsGuest() 为真时跳过）；进图时每人各扣自己的票（beforeEnter）
   官方依据与数值见 docs/GEAR.md
   ===================================================================== */
/* ---------------- 深渊背景：复用现有背景（同一个图片地址起别名），加深紫色调 + 飘散的深渊余烬 ---------------- */
function abyssTheme(id, from, tint) {
  for (const suf of ['far', 'floor', 'edge', 'mid', 'fore']) { const k = `bg/${from}_${suf}`; if (ASSET_SRC[k]) { ASSET_SRC[`bg/${id}_${suf}`] = ASSET_SRC[k]; ASSET_BUNDLE[`bg/${id}_${suf}`] = 'bg:' + id; } }
  BG_GRADE[id] = { ...(BG_GRADE[from] || {}), tint, fog: 'rgba(170,60,255,0.14)' };
  const T = THEMES[from] || {};
  THEMES[id] = { ...T, ambient(c, room) { if (T.ambient) T.ambient(c, room); abyssAmbient(c, room); } };
}
let abyssGlow = null;
function abyssAmbient(c) {
  if (!abyssGlow) { const [cv, x] = offCanvas(64, 128); const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, 'rgba(120,20,200,0)'); g.addColorStop(1, 'rgba(150,40,255,0.55)'); x.fillStyle = g; x.fillRect(0, 0, 64, 128); abyssGlow = cv; }
  c.save(); c.globalCompositeOperation = 'lighter';
  c.globalAlpha = 0.35 + 0.1 * Math.sin(game.t * 1.3); c.drawImage(abyssGlow, 0, WH - 220, WW, 220);   // 地面升起的紫雾
  for (let i = 0; i < 26; i++) {   // 余烬：从下往上飘
    const sp = 22 + (i * 37) % 30, ph = (game.t * sp + i * 97) % (WH + 40), x = ((i * 173 + Math.sin(game.t * 0.7 + i) * 30 - cam.x * 0.3) % WW + WW) % WW, y = WH - ph;
    c.globalAlpha = 0.25 + 0.5 * (1 - ph / WH); c.fillStyle = i % 3 ? '#c86aff' : '#ff6ad8'; c.fillRect(x, y, 3, 3);
  }
  c.restore();
}

/* ---------------- 封印之门（深渊之间的机关，打破后召唤深渊派对）：不动、不攻击，画成竖立旋转的紫色魔法阵 ---------------- */
class AbyssSealModel {
  constructor() { this.skel = { map: {} }; }
  draw(c, pose, t) {
    const hex = typeof fxTint === 'function' ? fxTint('hexagram', '#c05aff') : null, pil = typeof fxTint === 'function' ? fxTint('pillar', '#a040ff') : null;
    c.save(); c.globalCompositeOperation = 'lighter';
    if (pil) { c.globalAlpha = 0.55 + 0.15 * Math.sin(t * 3); c.drawImage(pil, -44, -210, 88, 210); }
    if (hex) { c.globalAlpha = 0.9; c.save(); c.translate(0, -92); c.rotate(t * 0.8); c.scale(1, 1); c.drawImage(hex, -70, -70, 140, 140); c.restore();
      c.globalAlpha = 0.5; c.save(); c.translate(0, -2); c.scale(1, 0.3); c.rotate(-t * 1.2); c.drawImage(hex, -90, -90, 180, 180); c.restore(); }
    c.restore();
    const im = IMG['icon/item_gear_seal'];   // 封印水晶（装备深化的图标表里画的）
    if (im) { const b = Math.sin(t * 2) * 4; c.drawImage(im, -64, -166 + b, 128, 128); return; }
    // 没有美术时：代码画的深渊水晶
    c.fillStyle = '#2a0a3a'; c.strokeStyle = '#e0a0ff'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, -150); c.lineTo(20, -95); c.lineTo(0, -40); c.lineTo(-20, -95); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = `rgba(230,150,255,${0.5 + 0.4 * Math.sin(t * 4)})`; c.beginPath(); c.moveTo(0, -130); c.lineTo(9, -95); c.lineTo(0, -60); c.lineTo(-9, -95); c.closePath(); c.fill();
  }
}
MON.abyssSeal = { name: '封印之门', lvl: 1, hp: 16000, atk: 1, def: 200, w: 26, d: 16, h: 150, weight: 99, speed: 0, exp: 60, gold: [20, 40], shadowR: 40, pref: 0,
  model: () => new AbyssSealModel(), clips: typeof HUMAN_CLIPS !== 'undefined' ? HUMAN_CLIPS : GOB_CLIPS, attacks: [],
  onDamaged(t) { if (!t.guardSpawned && t.hp < t.hpMax * 0.5 && !t.dead) { t.guardSpawned = true; abyssGuardian(t); } } };

/* ---------------- 深渊地下城 ----------------
   defineAbyss(id, { name, from?（复制这个地下城的怪物表 / 精英；没加载时整段跳过）, themeFrom（背景借用的主题）, theme, tint, lvl, layout | rooms/branches/rows, mobs?, elite?,
                     lords: [深渊领主候选], lordLvl, gate: { scene, x }, clearExp, desc, cost（邀请函张数）, pity（保底次数）, seal（封印之门血量倍率）,
                     waves: [{ n, mobs?, elite?（精英数）| elites?: [kind], say? }], lord: { hp, atk, mechs: [机制], cycle: [{ every: [s, s], at?, say?, mech }] },
                     quest: { id?, name, lvl, clear（要通关的地下城）, pre?, npc?, gold?, desc?, offer, done } }) */
const ABYSS = {};
const ABYSS_PITY = 6;   // 默认保底：连续 5 次没出史诗，第 6 次深渊领主必掉
const ABYSS_WAVES = [{ n: 5, elite: 1 }, { n: 6, elite: 1 }, { n: 7, elite: 2 }];
function abyssBeforeEnter(id) {
  return diff => {
    const A = ABYSS[id], D = DUNGEONS[id], n = A.cost;
    if (PARAMS.has('dungeon') && PARAMS.has('bot') && !inv.has('abyss_ticket', n)) inv.add(makeItem('abyss_ticket', n));   // 调试（?dungeon=abyss_gf&bot 机器人测试）：送票
    if (!inv.has('abyss_ticket', n)) { toastMsg(`需要「深渊派对邀请函」×${n} 才能进入${D.name}（歌兰蒂斯处可以购买）`, '#ff6a6a'); sfx.error(); return false; }
    inv.take('abyss_ticket', n);
    const force = PARAMS.get('abyssLord');   // 调试：?abyssLord=lotus 指定深渊领主
    D.boss = { kind: force && A.lords.includes(force) ? force : pick(A.lords.filter(k => MON[k])), lvl: A.lordLvl };   // 深渊领主每次随机（dungeonBundles 按它加载素材）
    const S = abyssData(); S.runs = (S.runs || 0) + 1; S.clears[id] = S.clears[id] || 0;
    toastMsg(`消耗 深渊派对邀请函 ×${n}（剩余 ${inv.count('abyss_ticket')}）· 史诗保底 ${S.pity[id] || 0}/${A.pity}`, '#e0a0ff', 'log'); gearSfx.abyssOpen();
    save.write();
    return true;
  };
}
function defineAbyss(id, o) {
  const B = o.from ? DUNGEONS[o.from] : null;
  if (o.from && !B) return false;                                   // 基础地下城由别的内容包提供，还没加载
  const lords = o.lords.filter(k => MON[k]); if (!lords.length) return false;
  const theme = o.theme || 'abyss_' + id, from = o.themeFrom || (B && B.theme);
  abyssTheme(theme, from, o.tint || 'rgba(80,10,120,0.32)');
  const waves = o.waves || ABYSS_WAVES, mobs = (o.mobs || B.mobs.filter(m => m[1] > 0)).slice(), elite = o.elite || (B && B.elite);
  for (const W of waves) for (const k of [...(W.mobs || []).map(m => m[0]), ...(W.elites || [])]) if (MON[k] && !mobs.some(m => m[0] === k)) mobs.push([k, 0]);   // 只在派对里出场的怪：权重 0（普通房间不刷，精灵随地下城一起加载）
  const Q = o.quest, qid = Q.id || 'q_' + id, G = o.gate || { scene: o.scene, x: o.x }, L = (typeof REGION_LAYOUT !== 'undefined' && REGION_LAYOUT[o.layout]) || {};
  ABYSS[id] = { id, name: o.name, scene: G.scene, x: G.x, lords, lordLvl: o.lordLvl, quest: qid, cost: o.cost || 1, pity: o.pity || ABYSS_PITY, seal: o.seal || 1, waves, region: o.region || '',
    lord: { hp: 1.35, atk: 1.1, mechs: [], cycle: [], ...o.lord } };
  defineDungeon(id, { name: o.name, lvl: o.lvl, theme, rooms: o.rooms || L.rooms || 5, branches: o.branches ?? L.branches ?? 1, rows: o.rows || L.rows || 3, ...(L.cols ? { cols: L.cols } : {}), hidden: true, abyss: true, unlock: { quest: qid },
    mobs, elite, boss: { kind: lords[0], lvl: o.lordLvl }, bossAdds: o.bossAdds || 2, clearExp: o.clearExp ?? Math.round(560 * o.lvl[1]), bgm: 'abyss', bossBgm: 'boss',
    desc: o.desc, beforeEnter: abyssBeforeEnter(id) });
  const S = SCENES[G.scene]; if (S && !S.gates.some(g => g.dungeon === id)) S.gates.push({ dungeon: id, x: G.x ?? S.width - 300 });   // 门：隐藏门的美术（紫色传送门）
  if (typeof GATE_ART !== 'undefined') GATE_ART[id] = { art: 'world/b_gate_hidden', col: '200,90,255' };
  if (typeof defineQuest === 'function') defineQuest(qid, { type: 'side', name: Q.name, npc: Q.npc || 'grandis', lvl: Q.lvl, pre: Q.pre || [], desc: Q.desc || `证明你的实力：通关${(DUNGEONS[Q.clear] || {}).name || Q.clear}，歌兰蒂斯就会告诉你${o.name}的入口。`,
    goals: [{ type: 'clear', dungeon: Q.clear, n: 1 }], talk: { offer: Q.offer, done: Q.done }, reward: { expFrac: 0.2, gold: Q.gold || 3000, items: [{ key: 'abyss_ticket', n: Q.tickets || 3 }] } });
  return true;
}
// 一个区域的 abyss 块：先建地下城，再把区域的深渊专属史诗标上 abyss / abyssFrom / abyssRegion（掉史诗时一半从这里出，保底优先没拿过的）
// R = 区域 spec（或 ABYSS_LEGACY 的一项）：{ id, abyss, items?（标了 abyss 的史诗 / 套装）, pool?（已有物品 key / 套装 id）, poolFrom?（按已有物品的 abyssFrom 认领）}
function regionAbyss(R) {
  const made = Object.entries(R.abyss || {}).filter(([id, o]) => defineAbyss(id, { ...o, region: R.id }));
  if (!made.length) return [];
  const I = R.items || {}, label = made.map(([, o]) => o.name).join('、');
  const keys = [...(I.epics || []).filter(e => e.abyss).map(e => e.key), ...(I.sets || []).filter(s => s.abyss).flatMap(s => s.pieces.map(p => p.key)),
    ...(R.pool || []).flatMap(k => (SETS[k] ? SETS[k].pieces : [k])), ...(R.poolFrom ? Object.keys(ITEMS).filter(k => ITEMS[k].abyssFrom === R.poolFrom) : [])];
  for (const k of keys) if (ITEMS[k]) Object.assign(ITEMS[k], { abyss: true, abyssFrom: label, abyssRegion: R.id });
  return made.map(([id]) => id);
}
// 本区域的深渊专属史诗（本职业能用的，等级 ≤ 领主等级 + 3）
function abyssPool(A) {
  const cls = game.player ? game.player.cls : null;
  return EPICS.filter(E => { const D = ITEMS[E.key]; return D && A.region && D.abyssRegion === A.region && E.lvl <= A.lordLvl + 3 && (!E.cls || E.cls === cls); }).map(E => E.key);
}
// 深渊史诗：一半出本区域的深渊专属（保底时必出，优先图鉴里还没有的），其余按领主等级随机
function abyssPickEpic(A, dg, pity) {
  const pool = abyssPool(A), cd = save.data.codex || {};
  if (pool.length && (pity || Math.random() < 0.5)) { const fresh = pity ? pool.filter(k => !cd[k]) : []; return makeItem(pick(fresh.length ? fresh : pool)); }
  return rollEpic(A.lordLvl || dg.def.lvl[1] + 2, { abyss: true, lo: dg.def.lvl[0] - 6 });
}

/* ---- 老区域的深渊（和区域 spec 的 abyss 块同一个格式；新区域直接写在自己的 spec 里） ---- */
const ABYSS_LEGACY = [
  { id: 'grand_flores', poolFrom: '格兰之森深渊', abyss: {
    abyss_gf: { name: '格兰之森深渊', themeFrom: 'ruinsDark', theme: 'abyssGF', tint: 'rgba(70,10,110,0.34)', lvl: [16, 19], rooms: 5, branches: 1,
      mobs: [['zombieRed', 2], ['plague', 1.5], ['tauBeast', 1], ['goblinBomber', 1], ['catVenom', 1.5], ['zombie', 2]], elite: 'tauBeast',
      lords: ['boneLord', 'flameMage', 'tauKing', 'catKing'], lordLvl: 21, gate: { scene: 'gf_graca', x: 300 }, clearExp: 7000, pity: 6,
      waves: [{ n: 5, mobs: [['zombie', 2], ['zombieRed', 2], ['plague', 1]], elite: 1, say: '饥饿的尸群涌上来了！' },
        { n: 6, mobs: [['goblinBomber', 1], ['catVenom', 1.5], ['plague', 1]], elite: 1, say: '小心自爆哥布林！' },
        { n: 6, mobs: [['tauBeast', 1], ['catVenom', 1], ['zombieRed', 1]], elite: 2, say: '牛头巨兽冲过来了！' }],
      lord: { mechs: [{ use: 'groggy', max: 80, dur: 6 }], cycle: [{ every: [24, 30], at: 0.7, mech: { use: 'safezone', windup: 3.4, frac: 0.3, say: '深渊之力——站进光圈！' } }] },
      desc: '【深渊派对】格拉卡最深处的裂缝通向深渊。需要消耗 1 张深渊派对邀请函。打破深渊之间的封印之门，击退三波深渊派对，深渊领主（每次随机）就会降临——它身上有史诗装备的气息。',
      quest: { id: 'q_abyss_gf', name: '深渊派对的资格', lvl: 15, clear: 'blazing_graca', gold: 2000, desc: '歌兰蒂斯感觉到格拉卡深处有深渊的气息。证明你的实力：通关烈焰格拉卡。',
        offer: ['……孩子，你也感觉到了吧？格拉卡的最深处，有一道通往深渊的裂缝。', '那里的恶魔会开派对——我们叫它「深渊派对」。打倒深渊领主，就有机会得到传说中的史诗装备。', '但那里很危险。先去通关烈焰格拉卡，让我看看你的实力。'],
        done: ['很好，你有资格了。这几张邀请函拿着——进入深渊派对，每次要消耗 1 张。', '格拉卡的左边，深渊的门已经为你打开。愿神的光辉与你同在。'] } } } },
  { id: 'sky_castle', poolFrom: '天空之城深渊', abyss: {
    abyss_sky: { name: '天空之城深渊', themeFrom: 'skyDark', theme: 'abyssSky', tint: 'rgba(80,10,120,0.32)', lvl: [23, 26], rooms: 5, branches: 1, rows: 4, bossAdds: 3,
      mobs: [['knight', 2], ['expellerAxe', 2], ['golemBronze', 1.5], ['kargoGoggle', 1.5], ['puppeteerRock', 1]], elite: 'hughes',
      lords: ['sinEye', 'seghart', 'skyExpeller', 'platani'], lordLvl: 28, gate: { scene: 'sky_castle', x: 3440 }, clearExp: 15000, pity: 6,
      waves: [{ n: 5, mobs: [['knight', 2], ['expellerAxe', 1]], elite: 1, say: '侍剑骑兵列阵！' },
        { n: 6, mobs: [['kargoGoggle', 1], ['puppeteerRock', 1], ['golemBronze', 1]], elite: 1, say: '人偶师在后面操纵——先打它！' },
        { n: 7, elite: 2, say: '深渊派对的高潮！' }],
      lord: { mechs: [{ use: 'groggy', max: 90, dur: 6 }], cycle: [{ every: [26, 32], at: 0.8, say: '深渊护盾！', mech: { use: 'shield', hp: 0.05, dur: 12, punish: 'heal', onBreak: 'groggy', col: '#c890ff' } },
        { every: [30, 36], at: 0.5, mech: { use: 'safezone', windup: 3.2, frac: 0.35, say: '深渊之力——站进光圈！' } }] },
      desc: '【深渊派对】天空之城尽头的深渊裂缝，Lv28 以上的史诗套装从这里开始出现。需要消耗 1 张深渊派对邀请函。打破封印之门，击退三波深渊派对，深渊领主（每次随机）降临，它会张开深渊护盾——打破护盾就能破招。',
      quest: { id: 'q_abyss_sky', name: '天空的深渊', lvl: 22, clear: 'lord_palace', pre: ['q_abyss_gf'], gold: 5000, desc: '天空之城的尽头也出现了深渊裂缝。通关城主宫殿，证明你能对付那里的深渊领主。',
        offer: ['天空之城的尽头，也裂开了一道深渊。', '那里的恶魔比格兰之森的强得多，身上也带着更好的装备——传说中的史诗套装。', '去通关城主宫殿吧，回来我就把天空之城深渊的路指给你。'],
        done: ['你果然做到了。天空之城最右边，深渊之门已经打开。', '记住：宇宙灵魂攒够了，就来我这里换你想要的装备。'] } } } },
  // 天帷巨兽（地下城内容组的区域，Lv24~30）：Lv30 前后最该刷的两张的深渊版；区域没加载时自动跳过。深渊专属：精炼的异界魔石（Lv30 首饰）
  { id: 'behemoth', pool: ['set_otherstone'], abyss: {
    abyss_spine: { name: '第二脊椎深渊', from: 'second_spine', theme: 'abyssSpine', lvl: [29, 30], rooms: 5, lords: ['lotus', 'yakshaKing', 'donnierEX', 'rodin'], lordLvl: 31, gate: { scene: 'behemoth_spine', x: 2500 }, clearExp: 17000, pity: 7,
      lord: { mechs: [{ use: 'groggy', max: 100, dur: 6 }, { use: 'enrage', t: 240 }], cycle: [{ every: [20, 26], mech: { use: 'hazard', kind: 'fire', every: 3, n: 2, dur: 9, col: '#c86aff' } },
        { every: [30, 36], at: 0.6, mech: { use: 'safezone', windup: 3.2, frac: 0.4, say: '深渊之力——站进光圈！' } }] },
      desc: '【深渊派对】天帷巨兽的第二脊椎深处，深渊的气息浓得化不开。需要消耗 1 张深渊派对邀请函。Lv30 之后追求史诗套装的地方。',
      quest: { id: 'q_abyss_spine', name: '巨兽体内的深渊', lvl: 29, clear: 'second_spine', pre: ['q_abyss_gf'], gold: 6000,
        offer: ['天帷巨兽的身体里……也有深渊的裂缝。', '去通关第二脊椎，回来我告诉你入口。'], done: ['入口就在第二脊椎附近。小心，那里的深渊领主比天空之城的更强。'] } },
    abyss_forbidden: { name: '天帷禁地深渊', from: 'forbidden_land', theme: 'abyssForbidden', lvl: [30, 30], rooms: 5, lords: ['marcel', 'lotus', 'gblArchbishop'], lordLvl: 32, gate: { scene: 'behemoth_spine', x: 2900 }, clearExp: 18000, pity: 7,
      lord: { mechs: [{ use: 'groggy', max: 110, dur: 6 }, { use: 'enrage', t: 240 }], cycle: [{ every: [18, 24], mech: { use: 'hazard', kind: 'debris', every: 3.5, n: 3, dur: 10, col: '#c86aff' } },
        { every: [28, 34], at: 0.7, say: '深渊护盾！', mech: { use: 'shield', hp: 0.05, dur: 12, punish: 'nova', onBreak: 'groggy', col: '#c890ff' } }] },
      desc: '【深渊派对】天帷禁地背后的深渊，是最危险、也是史诗气息最浓的地方。需要消耗 1 张深渊派对邀请函。',
      quest: { id: 'q_abyss_forbidden', name: '禁地的深渊', lvl: 30, clear: 'forbidden_land', pre: ['q_abyss_spine'], gold: 8000,
        offer: ['天帷禁地的背后还有一道深渊……据说连审判者都不敢靠近。', '通关天帷禁地，证明你已经是真正的强者。'], done: ['……你真的做到了。深渊之门为你打开了，去吧。'] } } } },
];
for (const R of [...ABYSS_LEGACY, ...Object.values(REGIONS).map(r => r.spec)]) { const ids = regionAbyss(R); if (REGIONS[R.id]) REGIONS[R.id].abyss = ids; }

/* ---------------- 深渊之间的流程（只在单机 / 主机上跑） ---------------- */
function abyssData() { const d = save.data; d.abyss = d.abyss || { runs: 0, clears: {}, epics: 0, day: '', bought: 0 }; d.abyss.clears = d.abyss.clears || {}; d.abyss.pity = d.abyss.pity || {}; return d.abyss; }
const abyssGuest = () => typeof netIsGuest === 'function' && netIsGuest();
bus.on('roomEnter', e => {
  const dg = game.dungeon; if (!dg || !dg.def.abyss || e.type !== 'boss' || abyssGuest()) return;
  const boss = dg.boss, W = game.room.x1, A = ABYSS[dg.def.id]; if (!boss || !A) return;
  const i = ents.indexOf(boss); if (i >= 0) ents.splice(i, 1);   // 领主先藏起来，派对结束后才降临
  game.lastTarget = null;
  const seal = spawnMonster('abyssSeal', W * 0.62, DEPTH / 2, { lvl: dg.def.lvl[1], mul: dg.D.hp * A.seal });
  seal.noGrab = true; seal.face = -1;
  dg.abyssRun = { phase: 'seal', wave: 0, boss, seal };
  toastMsg('深渊之间：打破「封印之门」，召唤深渊派对！', '#e0a0ff');
  cam.flash = 0.15; cam.flashCol = '#8a3aff'; sfx.boom(0.8);
  abyssTick(dg);
});
function abyssGuardian(seal) {
  const dg = game.dungeon; if (!dg || !dg.abyssRun) return;
  const m = spawnMonster(dg.def.elite, seal.x - 120, clamp(seal.y + rnd(-30, 30), 20, DEPTH - 20), { lvl: dg.def.lvl[1] + 2, elite: true, mul: dg.D.hp * 1.4, atkMul: dg.D.atk, drop: true });
  m.name = '堕落守护者'; m.guardian = true; m.scale *= 1.08;
  toastMsg('堕落守护者出现了！', '#ff6ad8'); fxShock(m.x, m.y, 160, '#c05aff');
}
function abyssWave(dg, n) {
  const def = dg.def, A = ABYSS[def.id], Wv = A.waves[n - 1] || {}, R = mulberry((Math.random() * 1e9) | 0), W = game.room.x1, lv = def.lvl[1] + 1;
  const mobs = Wv.mobs || def.mobs.filter(m => m[1] > 0), tot = mobs.reduce((s, m) => s + m[1], 0), pickMob = () => { let r = R() * tot; for (const m of mobs) { r -= m[1]; if (r <= 0) return m[0]; } return mobs[0][0]; };
  const cnt = Wv.n ?? 4 + n, o = { lvl: lv, mul: dg.D.hp, atkMul: dg.D.atk, expMul: dg.D.exp, drop: true };
  for (let i = 0; i < cnt; i++) spawnMonster(pickMob(), clamp(cam.x + 80 + R() * (WW - 160), 60, W - 60), 20 + R() * (DEPTH - 40), o).abyssMob = true;
  for (const k of Wv.elites || Array(Wv.elite ?? (n === 3 ? 2 : 1)).fill(def.elite)) { const m = spawnMonster(k || pickMob(), clamp(cam.x + WW * (0.3 + R() * 0.4), 60, W - 60), DEPTH / 2, { ...o, lvl: lv + 1, elite: true }); m.abyssMob = true; }
  toastMsg(`深渊派对 第 ${n}/${A.waves.length} 波！${Wv.say ? ' ' + Wv.say : ''}`, '#ff6ad8');
}
function abyssLord(dg) {
  const b = dg.abyssRun.boss, W = game.room.x1, p = game.player, L = ABYSS[dg.def.id].lord;
  b.hpMax = b.hp = Math.round(b.hpMax * L.hp); b.atk *= L.atk; b.name = '深渊领主 · ' + b.name; b.scale = (b.scale || 1) * 1.1;
  b.x = clamp(p.x + (p.x < W / 2 ? 360 : -360), 120, W - 120); b.y = DEPTH / 2; b.z = 200; b.vz = -60; b.invul = 1.5; b.dead = false; b.setState('jump'); b.abyssLord = true;
  ents.push(b); game.lastTarget = b; game.lastTargetT = game.t;
  abyssLordMechs(b, L);
  // 领主脚下的深渊光环（跟随，领主死后消失）
  addFx({ x: b.x, y: b.y - 1, z: 0, dur: 9999, ent: b, draw(c) {
    const e = this.ent; if (e.dead || game.dungeon !== dg) { this.t = this.dur; return; }
    const T = pillarTex('abyss'), s = 1 + 0.12 * Math.sin(game.t * 3); c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.75;
    c.drawImage(T.ring, sx(e.x) - 80 * s, sy(e.y, 0) - 22 * s, 160 * s, 44 * s); c.restore();
  } });
  fxSpr('pillar', b.x, b.y, 0, { h: 360, w: 140, dur: 1.2, ay: 1, col: '#b050ff' });
  cam.shake = 12; cam.flash = 0.3; cam.flashCol = '#6a1aaa'; sfx.boom(1.4); gearSfx.abyssOpen();
  toastMsg(`${b.name} 降临了！`, '#ff4ad0');
  music.play(dg.def.bossBgm || 'boss');
}
// 深渊领主的机制（领主机制库，game/mon_skills.js）：mechs 降临时启动；cycle 按间隔反复启动（at = 血量低于多少才开始）
// 区域领主本来就由 regionAI 驱动机制；老领主（手写 AI）在这里包一层 control / onDamaged 来驱动
function abyssLordMechs(b, L) {
  if (!L.mechs.length && !L.cycle.length) return;
  const own = b.control === regionAI, base = b.control, every = c => rnd(...(c.every || [24, 30]));
  for (const s of L.mechs) if (!msMechActive(b, s.use)) msMechStart(b, s);   // 区域领主自带的同种机制（比如暗杀者的狂暴）不重复加
  const cyc = L.cycle.map(c => ({ ...c, next: every(c) * 0.6 }));
  b.control = (m, dt) => {
    if (!m.dead && !m.msHidden) {
      if (!own && m.msMechs) msMechUpdate(m, dt);
      for (const c of cyc) if ((c.next -= dt) <= 0 && m.hp <= m.hpMax * (c.at ?? 1) && !msMechActive(m, c.mech.use) && !(m.stun > 0)) { c.next = every(c); if (c.say) msSay(m, c.say, '#ff9ad8', 15); msMechStart(m, c.mech); }
    }
    base(m, dt);
  };
  if (own) return;
  const od = b.onDamaged;
  b.onDamaged = (t, a, dmg, crit, h) => {
    if (od) od(t, a, dmg, crit, h);
    for (const st of t.msMechs || []) { const M = BOSS_MECHS[st.id]; if (!st.done && M.onHit) M.onHit(t, st, dmg, a, h); }
    if (t.msMul && t.msMul.invuln === 0) t.hp = Math.min(t.hpMax, t.hp + dmg);
  };
}
function abyssTick(dg) {
  if (game.dungeon !== dg || dg.state !== 'play' && dg.state !== 'dead') return;
  const R = dg.abyssRun; if (!R || R.phase === 'lord') return;
  game.after(0.35, () => abyssTick(dg));
  if (dg.state === 'dead') return;
  const alive = ents.some(e => e.team === 'e' && !e.dead);
  if (alive) return;
  if (R.phase === 'seal') { R.phase = 'waves'; R.wave = 0; cam.shake = 10; sfx.boom(1.2); toastMsg('封印之门被打破了！深渊派对开始！', '#ff6ad8'); }
  if (R.phase === 'waves') {
    if (R.wave < ABYSS[dg.def.id].waves.length) { R.wave++; abyssWave(dg, R.wave); }
    else { R.phase = 'lord'; abyssLord(dg); }
  }
}
bus.on('dungeonClear', e => {
  const D = DUNGEONS[e.id]; if (!D || !D.abyss || !save.data) return;
  const S = abyssData(); S.clears[e.id] = (S.clears[e.id] || 0) + 1;
});
bus.on('pickup', e => { const dg = game.dungeon; if (e.item && e.item.rar >= 5 && dg && dg.def.abyss && save.data) abyssData().epics++; });
bus.on('epicDrop', e => { const dg = game.dungeon; if (dg && dg.def.abyss) dg.abyssEpics = (dg.abyssEpics || 0) + 1; });   // 保底：这一趟出过史诗没有

/* ---------------- 额外掉落（drops.js 的 rollDrop 调用）：普通地下城 + 深渊派对 ---------------- */
function abyssExtraDrops(t, dg) {
  if (!dg || !dg.def || !t) return;
  const def = dg.def, lv = def.lvl[1], diff = dg.diff || 0, abyss = !!def.abyss, boss = !!t.boss, elite = !!t.elite;
  const drop = (key, n = 1, o = {}) => { const it = key && makeItem(key, n); if (it) spawnDrop({ kind: 'item', item: it, x: t.x + rnd(-24, 24), y: t.y, z: Math.max(t.z, 24), ...o }); return it; };
  const roll = p => Math.random() < p;
  // 怪物卡片
  const card = CARD_DROPS[t.kind]; if (card && roll((boss ? 0.06 : elite ? 0.02 : 0.003) * (abyss ? 2 : 1))) drop(card);
  if (!abyss) {
    // 深渊派对邀请函：Lv12 以上的地下城，领主为主；难度越高越容易掉
    if (lv >= 12 && roll((boss ? 0.3 : elite ? 0.03 : 0.003) * (1 + diff * 0.25))) drop('abyss_ticket');
    if (lv >= 10 && (boss ? roll(0.6) : elite && roll(0.06))) drop('m_aura', boss ? rndi(1, 2) : 1);
    if (lv >= 15 && boss && roll(0.25)) drop('m_contra', rndi(1, 2));
    if (lv >= 15 && boss && roll(0.04)) drop('amp_purify');
    return;
  }
  // ---- 深渊派对 ----
  const A = ABYSS[def.id] || { lordLvl: lv + 2 }, epic = pity => { const it = abyssPickEpic(A, dg, pity); if (it) spawnDrop({ kind: 'item', item: it, x: t.x, y: t.y, z: Math.max(t.z, 40), abyss: true }); return it; };
  const epicP = boss ? 0.28 + diff * 0.05 : t.guardian ? 0.08 : elite ? 0.03 : 0;
  if (epicP && roll(epicP)) epic(false);
  if (boss && A.pity && save.data) {   // 保底：这一趟一件史诗都没出，而且已经连续 pity-1 次没出 → 这次领主必掉
    const P = abyssData().pity, n = P[def.id] || 0;
    if (!dg.abyssEpics && n + 1 >= A.pity && epic(true)) toastMsg(`深渊保底！连续 ${n} 次没出史诗，这次必出`, '#ffd23a');
    P[def.id] = dg.abyssEpics ? 0 : n + 1;
  }
  if (t.kind === 'abyssSeal') { drop('m_cosmos'); return; }
  if (boss) {
    drop('m_cosmos', 2 + diff + (roll(0.5) ? 1 : 0));
    drop('m_contra', rndi(2, 4)); drop('m_aura', rndi(1, 3));
    if (roll(0.5)) drop('m_otherworld');
    if (roll(0.12)) drop('amp_purify');
    if (roll(0.03)) drop('amp_book');
    if (roll(0.15)) drop('abyss_ticket');
    if (roll(0.04)) { const k = abyssOtherworldPiece(); if (k) drop(k); }
  } else if (t.guardian) { drop('m_otherworld'); if (roll(0.5)) drop('m_contra', 2); }
  else if (elite) { if (roll(0.25)) drop('m_contra'); }
  else if (roll(0.01)) drop('m_contra');
}
// 异界套装：优先本转职的那一套
function abyssOtherworldPiece() {
  const sets = Object.values(SETS).filter(S => S.job), own = sets.filter(S => S.job === game.job), S = pick(own.length ? own : sets);
  return S ? pick(S.pieces) : null;
}

/* ---------------- 深渊宝藏：深渊派对的结算界面多一排紫色卡牌（免费翻一张；没翻就离开时随机给一张） ---------------- */
addStyle(`
#result .abyrow{position:absolute;right:1.6em;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;align-items:center;gap:.5em;padding:.7em .8em;border-radius:.6em;background:radial-gradient(ellipse at 50% 0%,rgba(150,50,220,.5),rgba(20,8,30,.9) 70%);border:.12em solid #9a4aff;box-shadow:0 0 1.2em rgba(170,70,255,.45)}
#result .abyrow .cards{grid-template-columns:repeat(3,5.6em);gap:.6em;margin-top:0}
#result .abyrow .card{width:5.6em;height:7.8em}
#result .abyrow .card .b{background:repeating-linear-gradient(45deg,#4a1a6a 0 .6em,#2a0a40 .6em 1.2em);border-color:#c06aff;color:#f0c8ff;font-size:2em}
#result .abyrow .card .f{border-color:#c06aff;font-size:.85em}#result .abyrow .card .f img{width:2.8em;height:2.8em}
#result .abyrow .abylbl{color:#f0c8ff;font-weight:900}#result .abyrow .abysub{color:#c8a8d8;font-size:.8em}
`);
function abyssCardReward(dg) {
  const r = Math.random(), A = ABYSS[dg.def.id] || {};
  if (r < 0.06) { const it = abyssPickEpic(A, dg, false); if (it) return { item: it }; }
  if (r < 0.40) return { item: makeItem('m_cosmos', rndi(2, 4)) };
  if (r < 0.62) return { item: makeItem('m_contra', rndi(3, 6)) };
  if (r < 0.80) return { item: makeItem('abyss_ticket', 1) };
  if (r < 0.92) return { item: makeItem('m_otherworld', 1) };
  return { gold: Math.round((600 + dg.def.lvl[1] * 120) * rnd(1, 2)) };
}
function abyssCardRow(dg) {
  const id = dg.def.id, A = ABYSS[id] || { pity: ABYSS_PITY }, S = abyssData(), rw = [0, 1, 2].map(() => abyssCardReward(dg));
  let picked = false;
  const face = r => r.gold ? [h('div', { style: 'font-size:2em' }, '💰'), h('b', { class: 'gold' }, `${fmtNum(r.gold)} G`)] : [h('img', { src: itemIconURL(r.item) }), h('b', { class: `r${r.item.rar || 0}` }, (r.item.n > 1 ? r.item.n + '× ' : '') + r.item.name)];
  const sub = h('div', { class: 'abysub' }, `史诗保底 ${S.pity[id] || 0}/${A.pity}`);
  const flip = i => {
    if (picked) return; picked = true; const r = rw[i];
    cards[i].classList.add('flip'); sfx.card();
    if (r.gold) { game.gold += r.gold; sfx.coin(); } else { giveItem(r.item); if ((r.item.rar || 0) >= 5) { sfx.epic(); S.epics = (S.epics || 0) + 1; S.pity[id] = 0; sub.textContent = `史诗保底 0/${A.pity}`; } }
    save.write();
    cards.forEach((c, j) => j !== i && setTimeout(() => { c.classList.add('flip', 'used'); c.style.opacity = 0.55; }, 600));
  };
  const cards = rw.map((r, i) => { const c = h('div', { class: 'card abyc' }, h('div', { class: 'in' }, h('div', { class: 'b' }, '✦'), h('div', { class: 'f' }, ...face(r)))); c.addEventListener('click', () => flip(i)); return c; });
  const row = h('div', { class: 'abyrow' }, h('div', { class: 'abylbl' }, '深渊宝藏 · 免费翻一张'), h('div', { class: 'cards' }, cards), sub);
  row._auto = () => { if (!picked) flip(rndi(0, 2)); };
  return row;
}
{
const baseResult = menus.w_result;
menus.w_result = function (dg) {
  const el = baseResult.call(this, dg);
  if (el && dg && dg.def.abyss) {
    const row = abyssCardRow(dg); el.append(row);
    el.addEventListener('click', ev => { if (ev.target.closest && ev.target.closest('.btn')) row._auto(); }, true);   // 点“再次挑战 / 返回城镇”之前没翻：随机给一张
  }
  return el;
};
}

/* ---------------- 每日的邀请函：完成资格任务后，每天第 3 次通关地下城（不限哪张）时，歌兰蒂斯送来 2 张邀请函 ----------------
   （原先打算做成每日任务，但任务组的每日任务总数有上限（3~5 个），改成通关计数奖励，效果一样） */
const ABYSS_DAILY_N = 3, ABYSS_DAILY_TICKETS = 2;
bus.on('dungeonClear', () => {
  const d = save.data; if (!d || !(d.questDone || {}).q_abyss_gf) return;
  const S = abyssData(), day = dayKey();
  if (S.dailyDay !== day) { S.dailyDay = day; S.dailyN = 0; }
  if (S.dailyN >= ABYSS_DAILY_N) return;
  if (++S.dailyN === ABYSS_DAILY_N) { giveItem(makeItem('abyss_ticket', ABYSS_DAILY_TICKETS)); toastMsg(`歌兰蒂斯送来了今天的深渊派对邀请函 ×${ABYSS_DAILY_TICKETS}`, '#e0a0ff', 'log'); }
});

/* ---------------- NPC 功能入口（NPC 定义在 content/world/towns.js，这里追加功能按钮） ----------------
   歌兰蒂斯：深渊派对（官方：资格任务、邀请函、宇宙灵魂兑换史诗都在她这里）；凯丽：增幅（官方后期凯丽也能增幅）；林纳斯：锻造；罗莉安：附魔；赛丽亚：装备图鉴 */
{
const addSvc = (npc, svc) => { const N = NPCS[npc]; if (N && !N.services.includes(svc)) N.services.push(svc); };
addSvc('grandis', 'abyss'); addSvc('kiri', 'amplify'); addSvc('linus', 'forge'); addSvc('lorian', 'enchant'); addSvc('seria', 'codex');
if (NPCS.kiri && !NPCS.kiri.services.includes('shop:kiri')) NPCS.kiri.services.push('shop:kiri');
}
