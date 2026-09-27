/* =====================================================================
   深渊派对（装备深化）：官方刷史诗的核心玩法
   - 每个区域一张深渊地下城：格兰之森深渊（格拉卡最深处，Lv16~19）、天空之城深渊（天空之城尽头，Lv24~27）
     进入要消耗 1 张「深渊派对邀请函」；地下城门在歌兰蒂斯的资格任务完成后出现（隐藏门的现身特效）
   - 深渊之间（领主房）：先打破「封印之门」（血量过半时出现堕落守护者）→ 三波深渊派对小怪 → 深渊领主降临（每次随机）
   - 掉落：深渊领主有史诗几率（金色光柱 + 紫色光环）；通关必得宇宙灵魂（歌兰蒂斯处兑换史诗，保底）；矛盾的结晶体、强烈的气息、浓密的异界精髓
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
   defineAbyss(id, { name, from?（复制这个地下城的怪物表 / 精英；没加载时整段跳过）, themeFrom（背景借用的主题）, tint, lvl, rooms, branches, rows, mobs?, elite?,
                     lords: [深渊领主候选], lordLvl, scene（门所在的区域）, x, clearExp, desc, quest: { id, name, lvl, clear（要通关的地下城）, pre?, offer, done } }) */
const ABYSS = {};
function abyssBeforeEnter(id) {
  return diff => {
    if (PARAMS.has('dungeon') && PARAMS.has('bot') && !inv.has('abyss_ticket', 1)) inv.add(makeItem('abyss_ticket', 1));   // 调试（?dungeon=abyss_gf&bot 机器人测试）：送一张票
    if (!inv.has('abyss_ticket', 1)) { toastMsg('需要「深渊派对邀请函」才能进入深渊派对（歌兰蒂斯处可以购买）', '#ff6a6a'); sfx.error(); return false; }
    inv.take('abyss_ticket', 1);
    const A = ABYSS[id], D = DUNGEONS[id];
    D.boss = { kind: pick(A.lords.filter(k => MON[k])), lvl: A.lordLvl };   // 深渊领主每次随机（dungeonBundles 按它加载素材）
    const S = abyssData(); S.runs = (S.runs || 0) + 1; S.clears[id] = S.clears[id] || 0;
    toastMsg(`消耗 深渊派对邀请函 ×1（剩余 ${inv.count('abyss_ticket')}）`, '#e0a0ff'); gearSfx.abyssOpen();
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
  ABYSS[id] = { scene: o.scene, x: o.x, lords, lordLvl: o.lordLvl, quest: o.quest.id };
  defineDungeon(id, { name: o.name, lvl: o.lvl, theme, rooms: o.rooms || 5, branches: o.branches ?? 1, rows: o.rows || 3, hidden: true, abyss: true, unlock: { quest: o.quest.id },
    mobs: o.mobs || B.mobs.filter(m => m[1] > 0), elite: o.elite || (B && B.elite), boss: { kind: lords[0], lvl: o.lordLvl }, bossAdds: o.bossAdds || 2, clearExp: o.clearExp, bgm: 'abyss', bossBgm: 'boss',
    desc: o.desc, beforeEnter: abyssBeforeEnter(id) });
  const S = SCENES[o.scene]; if (S && !S.gates.some(g => g.dungeon === id)) S.gates.push({ dungeon: id, x: o.x ?? S.width - 300 });   // 门：隐藏门的美术（紫色传送门）
  if (typeof GATE_ART !== 'undefined') GATE_ART[id] = { art: 'world/b_gate_hidden', col: '200,90,255' };
  const Q = o.quest;
  if (typeof defineQuest === 'function') defineQuest(Q.id, { type: 'side', name: Q.name, npc: 'grandis', lvl: Q.lvl, pre: Q.pre || [], desc: Q.desc || `证明你的实力：通关${(DUNGEONS[Q.clear] || {}).name || Q.clear}，歌兰蒂斯就会告诉你${o.name}的入口。`,
    goals: [{ type: 'clear', dungeon: Q.clear, n: 1 }], talk: { offer: Q.offer, done: Q.done }, reward: { expFrac: 0.2, gold: Q.gold || 3000, items: [{ key: 'abyss_ticket', n: 3 }] } });
  return true;
}
defineAbyss('abyss_gf', { name: '格兰之森深渊', themeFrom: 'ruinsDark', theme: 'abyssGF', tint: 'rgba(70,10,110,0.34)', lvl: [16, 19], rooms: 5, branches: 1,
  mobs: [['zombieRed', 2], ['plague', 1.5], ['tauBeast', 1], ['goblinBomber', 1], ['catVenom', 1.5], ['zombie', 2]], elite: 'tauBeast',
  lords: ['boneLord', 'flameMage', 'tauKing', 'catKing'], lordLvl: 21, scene: 'gf_graca', x: 300, clearExp: 7000,
  desc: '【深渊派对】格拉卡最深处的裂缝通向深渊。需要消耗 1 张深渊派对邀请函。打破深渊之间的封印之门，击退三波深渊派对，深渊领主（每次随机）就会降临——它身上有史诗装备的气息。',
  quest: { id: 'q_abyss_gf', name: '深渊派对的资格', lvl: 15, clear: 'blazing_graca', gold: 2000, desc: '歌兰蒂斯感觉到格拉卡深处有深渊的气息。证明你的实力：通关烈焰格拉卡。',
    offer: ['……孩子，你也感觉到了吧？格拉卡的最深处，有一道通往深渊的裂缝。', '那里的恶魔会开派对——我们叫它「深渊派对」。打倒深渊领主，就有机会得到传说中的史诗装备。', '但那里很危险。先去通关烈焰格拉卡，让我看看你的实力。'],
    done: ['很好，你有资格了。这几张邀请函拿着——进入深渊派对，每次要消耗 1 张。', '格拉卡的左边，深渊的门已经为你打开。愿神的光辉与你同在。'] } });
defineAbyss('abyss_sky', { name: '天空之城深渊', themeFrom: 'skyDark', theme: 'abyssSky', tint: 'rgba(80,10,120,0.32)', lvl: [23, 26], rooms: 5, branches: 1, rows: 4, bossAdds: 3,
  mobs: [['knight', 2], ['expellerAxe', 2], ['golemBronze', 1.5], ['kargoGoggle', 1.5], ['puppeteerRock', 1]], elite: 'hughes',
  lords: ['sinEye', 'seghart', 'skyExpeller', 'platani'], lordLvl: 28, scene: 'sky_castle', x: 3440, clearExp: 15000,
  desc: '【深渊派对】天空之城尽头的深渊裂缝，Lv28 以上的史诗套装从这里开始出现。需要消耗 1 张深渊派对邀请函。打破封印之门，击退三波深渊派对，深渊领主（每次随机）降临。',
  quest: { id: 'q_abyss_sky', name: '天空的深渊', lvl: 22, clear: 'lord_palace', pre: ['q_abyss_gf'], gold: 5000, desc: '天空之城的尽头也出现了深渊裂缝。通关城主宫殿，证明你能对付那里的深渊领主。',
    offer: ['天空之城的尽头，也裂开了一道深渊。', '那里的恶魔比格兰之森的强得多，身上也带着更好的装备——传说中的史诗套装。', '去通关城主宫殿吧，回来我就把天空之城深渊的路指给你。'],
    done: ['你果然做到了。天空之城最右边，深渊之门已经打开。', '记住：宇宙灵魂攒够了，就来我这里换你想要的装备。'] } });
// 天帷巨兽（地下城内容组的区域，Lv24~30）：满级后最该刷的两张的深渊版；区域没加载时自动跳过
defineAbyss('abyss_spine', { name: '第二脊椎深渊', from: 'second_spine', lvl: [29, 30], rooms: 5, lords: ['lotus', 'yakshaKing', 'donnierEX', 'rodin'], lordLvl: 31, scene: 'behemoth_spine', x: 2500, clearExp: 17000,
  desc: '【深渊派对】天帷巨兽的第二脊椎深处，深渊的气息浓得化不开。需要消耗 1 张深渊派对邀请函。满级之后追求史诗套装的地方。',
  quest: { id: 'q_abyss_spine', name: '巨兽体内的深渊', lvl: 29, clear: 'second_spine', pre: ['q_abyss_gf'], gold: 6000,
    offer: ['天帷巨兽的身体里……也有深渊的裂缝。', '去通关第二脊椎，回来我告诉你入口。'], done: ['入口就在第二脊椎附近。小心，那里的深渊领主比天空之城的更强。'] } });
defineAbyss('abyss_forbidden', { name: '天帷禁地深渊', from: 'forbidden_land', lvl: [30, 30], rooms: 5, lords: ['marcel', 'lotus', 'gblArchbishop'], lordLvl: 32, scene: 'behemoth_spine', x: 2900, clearExp: 18000,
  desc: '【深渊派对】天帷禁地背后的深渊，是最危险、也是史诗气息最浓的地方。需要消耗 1 张深渊派对邀请函。',
  quest: { id: 'q_abyss_forbidden', name: '禁地的深渊', lvl: 30, clear: 'forbidden_land', pre: ['q_abyss_spine'], gold: 8000,
    offer: ['天帷禁地的背后还有一道深渊……据说连审判者都不敢靠近。', '通关天帷禁地，证明你已经是真正的强者。'], done: ['……你真的做到了。深渊之门为你打开了，去吧。'] } });

/* ---------------- 深渊之间的流程（只在单机 / 主机上跑） ---------------- */
function abyssData() { const d = save.data; d.abyss = d.abyss || { runs: 0, clears: {}, epics: 0, day: '', bought: 0 }; d.abyss.clears = d.abyss.clears || {}; return d.abyss; }
const abyssGuest = () => typeof netIsGuest === 'function' && netIsGuest();
bus.on('roomEnter', e => {
  const dg = game.dungeon; if (!dg || !dg.def.abyss || e.type !== 'boss' || abyssGuest()) return;
  const boss = dg.boss, W = game.room.x1; if (!boss) return;
  const i = ents.indexOf(boss); if (i >= 0) ents.splice(i, 1);   // 领主先藏起来，派对结束后才降临
  game.lastTarget = null;
  const seal = spawnMonster('abyssSeal', W * 0.62, DEPTH / 2, { lvl: dg.def.lvl[1], mul: dg.D.hp });
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
  const def = dg.def, R = mulberry((Math.random() * 1e9) | 0), W = game.room.x1, lv = def.lvl[1] + 1;
  const tot = def.mobs.reduce((s, m) => s + m[1], 0), pickMob = () => { let r = R() * tot; for (const m of def.mobs) { r -= m[1]; if (r <= 0) return m[0]; } return def.mobs[0][0]; };
  const cnt = 4 + n, o = { lvl: lv, mul: dg.D.hp, atkMul: dg.D.atk, expMul: dg.D.exp, drop: true };
  for (let i = 0; i < cnt; i++) spawnMonster(pickMob(), clamp(cam.x + 80 + R() * (WW - 160), 60, W - 60), 20 + R() * (DEPTH - 40), o).abyssMob = true;
  for (let i = 0; i < (n === 3 ? 2 : 1); i++) { const m = spawnMonster(def.elite || pickMob(), clamp(cam.x + WW * (0.3 + R() * 0.4), 60, W - 60), DEPTH / 2, { ...o, lvl: lv + 1, elite: true }); m.abyssMob = true; }
  toastMsg(`深渊派对 第 ${n} 波！`, '#ff6ad8');
}
function abyssLord(dg) {
  const b = dg.abyssRun.boss, W = game.room.x1, p = game.player;
  b.hpMax = b.hp = Math.round(b.hpMax * 1.35); b.atk *= 1.1; b.name = '深渊领主 · ' + b.name; b.scale = (b.scale || 1) * 1.1;
  b.x = clamp(p.x + (p.x < W / 2 ? 360 : -360), 120, W - 120); b.y = DEPTH / 2; b.z = 200; b.vz = -60; b.invul = 1.5; b.dead = false; b.setState('jump'); b.abyssLord = true;
  ents.push(b); game.lastTarget = b; game.lastTargetT = game.t;
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
function abyssTick(dg) {
  if (game.dungeon !== dg || dg.state !== 'play' && dg.state !== 'dead') return;
  const R = dg.abyssRun; if (!R || R.phase === 'lord') return;
  game.after(0.35, () => abyssTick(dg));
  if (dg.state === 'dead') return;
  const alive = ents.some(e => e.team === 'e' && !e.dead);
  if (alive) return;
  if (R.phase === 'seal') { R.phase = 'waves'; R.wave = 0; cam.shake = 10; sfx.boom(1.2); toastMsg('封印之门被打破了！深渊派对开始！', '#ff6ad8'); }
  if (R.phase === 'waves') {
    if (R.wave < 3) { R.wave++; abyssWave(dg, R.wave); }
    else { R.phase = 'lord'; abyssLord(dg); }
  }
}
bus.on('dungeonClear', e => {
  const D = DUNGEONS[e.id]; if (!D || !D.abyss || !save.data) return;
  const S = abyssData(); S.clears[e.id] = (S.clears[e.id] || 0) + 1;
});
bus.on('pickup', e => { const dg = game.dungeon; if (e.item && e.item.rar >= 5 && dg && dg.def.abyss && save.data) abyssData().epics++; });

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
  const lordLv = (ABYSS[def.id] || {}).lordLvl || lv + 2, epicP = (boss ? 0.22 : t.guardian ? 0.05 : elite ? 0.02 : 0) + (boss ? diff * 0.04 : 0);
  if (epicP && roll(epicP)) { const it = rollEpic(lordLv, { abyss: true, lo: def.lvl[0] - 6 }); if (it) spawnDrop({ kind: 'item', item: it, x: t.x, y: t.y, z: Math.max(t.z, 40), abyss: true }); }
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

/* ---------------- 任务：资格任务（解锁深渊门）+ 每日（邀请函） ---------------- */
if (typeof defineQuest === 'function') {
  defineQuest('d_abyss', { type: 'daily', name: '深渊的呼唤', npc: 'grandis', lvl: 16, pre: ['q_abyss_gf'],
    desc: '【每日】通关任意地下城 3 次，歌兰蒂斯会送你深渊派对邀请函。',
    goals: [{ type: 'clear', dungeon: 'any', n: 3 }],
    talk: { offer: ['深渊的气息每天都在变浓。', '通关 3 次地下城回来，我给你准备邀请函。'], done: ['辛苦了。这些邀请函，好好用。'] },
    reward: { expFrac: 0.05, gold: 1000, items: [{ key: 'abyss_ticket', n: 2 }] } });
}

/* ---------------- NPC 功能入口（NPC 定义在 content/world/towns.js，这里追加功能按钮） ----------------
   歌兰蒂斯：深渊派对（官方：资格任务、邀请函、宇宙灵魂兑换史诗都在她这里）；凯丽：增幅（官方后期凯丽也能增幅）；林纳斯：锻造；罗莉安：附魔；赛丽亚：装备图鉴 */
{
const addSvc = (npc, svc) => { const N = NPCS[npc]; if (N && !N.services.includes(svc)) N.services.push(svc); };
addSvc('grandis', 'abyss'); addSvc('kiri', 'amplify'); addSvc('linus', 'forge'); addSvc('lorian', 'enchant'); addSvc('seria', 'codex');
if (NPCS.kiri && !NPCS.kiri.services.includes('shop:kiri')) NPCS.kiri.services.push('shop:kiri');
}
