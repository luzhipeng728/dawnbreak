/* =====================================================================
   区域流水线 · 生成器：defineRegion(spec) 把一份纯数据的区域 spec 展开成
   主题（程序兜底 + 色调）→ 怪物 / 领主（技能库 + 机制库，数值按一条等级公式）→ 史诗 / 套装 → 地下城（房间模板）+ 门 + 掉落表
   → NPC / 城镇 / 区域地图 + 从已有场景接进来的入口 → 主线任务（到达 / 对话 / 通关 / 领主 / 收集 / 交付 模板）
   spec 的写法见 docs/REGION_PIPELINE.md；美术由 art/tools/region_art.py 读同一份 spec 批量生成
   ===================================================================== */
const REGIONS = {};
const REGION_HOOKS = {};   // 领主的自定义钩子：REGION_HOOKS[名字] = { onSpawn, onPhase, update, onHit, hud }，spec 里 boss.hook 写名字
// ---- 数值：一条等级公式 × 类型系数（参照天空之城 / 天帷巨兽的曲线：Lv30 普通怪 hp≈9600、领主 hp≈168000）----
const REGION_TIER = {
  swarm: { hp: 0.5, atk: 0.95, def: 0.8, exp: 0.7 }, caster: { hp: 0.74, atk: 1, def: 0.85, exp: 0.95 }, normal: { hp: 1, atk: 1, def: 1, exp: 1 },
  flier: { hp: 0.8, atk: 1, def: 0.9, exp: 0.95 }, brute: { hp: 1.35, atk: 1.03, def: 1.12, exp: 1.08 }, elite: { hp: 1.6, atk: 1.04, def: 1.15, exp: 1.6 },
};
function regionStats(tier, lvl, power = 1, atkPower = 1 + (power - 1) * 0.5) {
  const r = Math.round, pa = atkPower;
  if (tier === 'boss' || tier === 'raid') { const k = tier === 'raid' ? 1.4 : 1; return { hp: r(5600 * lvl * k * power), atk: r(11.3 * lvl * pa * (tier === 'raid' ? 1.03 : 1)), def: r(21.5 * lvl), exp: r(150 * lvl * k), gold: [r(16 * lvl * k), r(28.6 * lvl * k)], bars: r(lvl * k) }; }
  const T = REGION_TIER[tier] || REGION_TIER.normal;
  return { hp: r((260 * lvl + 1800) * T.hp * power), atk: r((150 + 4.2 * lvl) * T.atk * pa), def: r((16 * lvl + 60) * T.def), exp: r((3.2 * lvl + 40) * T.exp), gold: [r(lvl * 1.1 + 3), r(lvl * 2.2 + 6)] };
}
// ---- 房间模板（dungeon.js 的随机网格参数）----
const REGION_LAYOUT = {
  short: { rooms: 5, branches: 1, rows: 3, cols: 4 },
  standard: { rooms: 6, branches: 2, rows: 3, cols: 5 },
  long: { rooms: 7, branches: 3, rows: 4, cols: 5 },
  raid: { rooms: 4, branches: 0, rows: 1, cols: 4 },   // 一条直线：入口 → 两个前哨房 → 领主房
  ancient: { rooms: 6, branches: 0, rows: 1, cols: 6 },   // 远古：一条直线 6 房，每个房间由钩子脚本单独布置（content/regions/ancient_rooms.js）
};
// ---- 没有逐帧精灵时的程序外观（美术还没出的时候也能先跑通）----
const REGION_LOOKS = { zombie: pal => buildZombie(pal), cat: pal => buildCat(pal), tau: pal => buildTau(pal, { weapon: 'none' }), goblin: pal => buildGoblin({ ...PAL_GOB, ...pal }) };
const regionLook = L => { const [k, pal] = L || ['zombie', { skin: '#c8b8d8', hair: '#2a1a3a', eye: '#ff4a6a', cloth: '#3a2a5a', pants: '#1a1428' }]; return () => REGION_LOOKS[k](pal || {}); };
// ---- 场景主题：程序兜底画面（手绘背景缺失时用）+ 色调 + 环境粒子 ----
const REGION_AMBIENT = {
  motes: (c, rgb) => skyMotes(c, 22, rgb, 16),
  wisps: (c, rgb) => bhWisps(c, 10, rgb),
  bubbles: c => bhBubbles(c, 12),
};
function regionTheme(id, T) {
  const P = { sky: ['#1a1030', '#3a2458', '#6a4a8a'], far: '#140a20', mid: ['#2a1e3a', '#3a2a4a', '#1a1228'], haze: '#8a5aff', wall: ['#2a2234', '#1e1828'], floor: ['#2e2638', '#382e44', '#261e30'], line: 'rgba(160,110,255,.45)', fore: ['#1e1628', '#2a2034', '#140e1c'], ...T.pal };
  BG_GRADE[id] = T.grade || { tint: 'rgba(90,50,140,0.12)', fog: 'rgba(170,130,255,0.08)' };
  THEMES[id] = {
    sky: P.sky[0],
    far(c, w, R) { skyGrad(c, w, [[0, P.sky[0]], [0.6, P.sky[1]], [1, P.sky[2]]]); mountains(c, w, FLOOR_Y + 10, 110, P.far, R, 60); },
    mid(c, w, R) { for (let x = 0; x < w; x += 200 + R() * 160) column(c, x, FLOOR_Y + 6, 130 + R() * 40, 28, P.mid, R, R() < 0.5); hazeBand(c, w, FLOOR_Y - 90, FLOOR_Y + 10, P.haze); },
    wall(c, w, R) { brickWall(c, 0, w, FLOOR_Y - 30, FLOOR_Y, P.wall, R); },
    floor(c, w, R) { flagstones(c, w, FLOOR_Y - 4, P.floor, R, P.line); },
    fore(c, w, R) { for (let x = 80; x < w; x += 380 + R() * 220) column(c, x, WH + 30, 150, 34, P.fore, R, true); },
    ambient(c) { (REGION_AMBIENT[T.ambient] || REGION_AMBIENT.motes)(c, T.rgb || '200,160,255'); },
  };
}
// spec 里递归找出所有被引用的怪物 id（召唤 / 无敌阶段的小怪 / 连线搭档 / 分身），给精灵分包预加载
// 第二批原语（docs/BOSS_SPEC.md）引用怪物的写法：duo 的 with、lanes 的 runner、protect 的 threat、plant 的 operator / onFuse: 'hatch:<怪物>' / 'release:<怪物>xN'、arena / mark 的 cover
const REGION_KIND_KEYS = new Set(['kind', 'runner', 'threat', 'operator', 'cover']);
function regionKinds(o, out = new Set()) {
  if (Array.isArray(o)) o.forEach(x => regionKinds(x, out));
  else if (o && typeof o === 'object') for (const k in o) {
    const v = o[k];
    if (REGION_KIND_KEYS.has(k) && typeof v === 'string') out.add(v);
    else if ((k === 'with' || k === 'threat') && Array.isArray(v)) v.forEach(x => typeof x === 'string' && out.add(x));
    else if (k === 'onFuse' && typeof v === 'string' && v.includes(':')) out.add(v.split(':')[1].split('x')[0]);
    else if (k === 'use' && v === 'clones') out.add('#shade');
    else regionKinds(v, out);
  }
  return out;
}
// form 换图：每个带 art 的形态登记一个隐藏的美术名（<领主>Form<n>），素材随领主一起预加载（monBundles 按 MON_ART 找分包）
function regionFormArt(id, o, out = []) {
  if (Array.isArray(o)) o.forEach(x => regionFormArt(id, x, out));
  else if (o && typeof o === 'object') { if (o.use === 'form' && o.art) { const k = `${id}Form${out.length + 1}`; MON_ART[k] = [].concat(o.art); out.push(k); } for (const k in o) if (o[k] && typeof o[k] === 'object') regionFormArt(id, o[k], out); }
  return out;
}
// ---- 怪物 / 领主 ----
function regionMonster(spec, id, M, boss) {
  const A = MS_ARCH[M.arch || (boss ? 'boss' : 'aggressive')] || MS_ARCH.aggressive, lvl = M.lvl || spec.lvl, T = M.traits || {};
  const S = regionStats(M.tier || (boss ? 'boss' : 'normal'), lvl, (spec.power || 1) * (boss ? spec.bossPower || 1 : 1) * (M.power || 1), spec.atkPower && spec.atkPower * (M.atkPower || 1));
  const [w, d, h] = M.size || [13, 12, 96];
  if (M.obj) {   // 物件怪（蛋 / 图腾 / 柱子 / 掩体）：不动、不出手，程序画（有 art 就用精灵）
    const D = MON[id] = { ...msObjDef(M.name, { h, w, ...M.obj }), lvl, hp: S.hp, def: S.def, region: spec.id, msKind: id, msTraits: T, elem: M.elem, msCover: !!M.obj.cover, botSkip: M.obj.botSkip ?? !!M.obj.cover };
    if (M.art) { MON_ART[id] = [].concat(M.art); D.customModel = false; }
    msTraitPrecompile(D);
    return D;
  }
  const D = MON[id] = { name: M.name, lvl, hp: S.hp, atk: S.atk, def: S.def, w, d, h, weight: M.weight ?? (boss ? 3 : 1.2), speed: M.speed ?? A.speed, exp: S.exp, gold: S.gold, shadowR: Math.round(w * 1.35), pref: M.pref ?? A.pref,
    clips: BEAST_CLIPS, scale: M.scale || (boss ? 1.15 : 1), noGrab: M.noGrab ?? A.noGrab ?? boss, hardness: (M.hardness || 0) + (A.hardness || 0), elem: M.elem, msArch: A, msTraits: T, msSa: T.sa, region: spec.id, boss_: boss,
    model: regionLook(M.look), onSpawn: msOnSpawn, onDamaged: msOnDamaged, attacks: [], msKind: id };
  if (boss) { D.bars = S.bars; D.hook = M.hook; D.msMechs = M.mechs || []; }
  if (boss && M.phases) {
    D.msPhases = M.phases.map((P, i) => ({ at: P.at ?? 1, enter: P.enter }));
    const n = M.phases.length, from = i => Array.from({ length: n - i }, (_, k) => i + k);   // 阶段技能默认从这个阶段起一直可用；P.only = 只在这个阶段
    D.attacks = [...(M.skills || []).map(s => monSkill(s, D)), ...M.phases.flatMap((P, i) => (P.skills || []).map(s => monSkill({ phase: P.only ? i : from(i), ...s }, D)))];
  } else D.attacks = (M.skills || []).map(s => monSkill(s, D));
  msPrecompile(D, [M.mechs, M.phases, M.skills]); msTraitPrecompile(D);   // 机制 / 特性里嵌套的招式（stagger 的大招、form / stance 的招式、back / onGetup 的反击）
  if (M.art) MON_ART[id] = [].concat(M.art);
  const kinds = regionKinds([M.skills, M.phases, M.mechs, M.traits]);
  D.summons = [...[...kinds].map(k => (k === '#shade' ? id + 'Shade' : k)), ...regionFormArt(id, [M.mechs, M.phases, M.skills])];
  // 分身：领主的暗影（同一套精灵、压暗；只会领主的前两招）
  if (kinds.has('#shade')) {
    const base = (M.phases ? M.phases[0].skills : M.skills) || [];
    const SD = MON[id + 'Shade'] = { ...D, name: M.shadeName || `${M.name}的暗影`, msShadeOf: id, boss_: false, bars: undefined, hook: undefined, msMechs: undefined, msPhases: undefined, exp: 0, gold: [0, 0], summons: [], attacks: [] };
    SD.attacks = base.slice(0, 2).map(s => monSkill({ ...s, dmg: (s.dmg ?? 1) * 0.6 }, SD));
    if (M.art) MON_ART[id + 'Shade'] = [[].concat(M.art)[0], { ...([].concat(M.art)[1] || {}), bright: 0.62, sat: 0.55 }];
  }
  return D;
}
// ---- 史诗 / 套装（spec.items.epics / spec.items.sets）；look 是给美术管线的图标描述 ----
const regionStrip = o => { const { look, ...rest } = o; return rest; };
function regionItems(spec) {
  const I = spec.items || {};
  for (const E of I.epics || []) defineEpic(E.key, regionStrip(E));
  for (const S of I.sets || []) {
    defineSet(S.id, { name: S.name, bonus: S.bonus, epic: true });
    for (const P of S.pieces) { defineGear(P.key, { rar: 5, fx: {}, icon: 'item_' + P.key, lvl: S.lvl, desc: S.desc, ...regionStrip(P), set: S.id }); SETS[S.id].pieces.push(P.key); }
  }
}
// ---- 主线任务模板：arrive 到达 | talk 对话 | clear 通关 | boss 打倒领主（可带 collect 收集道具）| raid 同 boss | handin 交付 ----
function regionQuests(spec) {
  const Q = spec.story; if (!Q) return [];
  const ids = []; let prev = Q.pre;
  Q.steps.forEach((s, i) => {
    const id = s.id || `${Q.prefix}${String(i + 1).padStart(2, '0')}`, G = s.dungeon && spec.dungeons[s.dungeon], bk = G && G.boss, bn = bk && MON[bk].name;
    const goals = s.t === 'arrive' ? [{ type: 'reach', scene: s.scene }]
      : s.t === 'talk' ? [{ type: 'talk', npc: s.with, lines: s.lines }]
      : s.t === 'clear' ? [{ type: 'clear', dungeon: s.dungeon, ...(s.diff ? { diff: s.diff } : {}) }]
      : s.t === 'boss' || s.t === 'raid' ? [s.collect ? { type: 'collect', ...s.collect, from: bk, boss: true, dungeon: s.dungeon, rate: 1, rar: s.collect.rar || 3 } : { type: 'kill', kind: bk, boss: true, dungeon: s.dungeon, text: `在${G.name}打倒${bn}` }]
      : [];
    const lv = s.lvl || spec.lvl, { exp: rx, gold: rg, ...rest } = s.reward || {};
    defineQuest(id, { type: 'main', chapter: Q.chapter, name: s.name, npc: s.npc || Q.npc, to: s.to, lvl: lv, pre: prev, desc: s.desc, goals, talk: s.talk, cond: () => !!SCENES[Q.scene],
      reward: QR(lv, rx ?? 0.1, rg ?? 3000, rest) });
    ids.push(id); prev = id;
  });
  return ids;
}
// ---- 每日 / 支线 / 区域制霸链（content/quests/regions.js 按区域登记，docs/REGION_PIPELINE.md §2.3）----
// Q = { chapter, scene（这个场景不在 = 区域没加载，任务不出现）, npc（默认发放人）, dailies: [任务], sides: [任务], tour: { pre, npc, lvl, steps: [{ id, name, dungeons, pre?, lvl?, desc, talk, reward }] } }
// 任务写法同 defineQuest；每日的 reward 原样（expFrac 按玩家当前等级）；支线 / 制霸的 reward { exp: 比例, gold, ... } 走 QR（和主线同一条曲线）
// 制霸链：每一步 = 通关 dungeons 里的每个地下城各一次，前后串成一条链；不能“一键完成”（noQuick），满级也得真的去打
function defineRegionQuests(rid, Q) {
  const R = REGIONS[rid]; if (!R) return;
  const cond = () => !!SCENES[Q.scene];
  const side = (s, o) => { const { exp, gold, ...rest } = s.reward || {}; return defineQuest(s.id, { type: 'side', chapter: Q.chapter, npc: Q.npc, cond, ...s, ...o, reward: QR(s.lvl, exp ?? 0.08, gold ?? 4000, rest) }).id; };
  R.dailies = (Q.dailies || []).map(s => defineQuest(s.id, { type: 'daily', chapter: Q.chapter, npc: Q.npc, cond, ...s }).id);
  R.sides = (Q.sides || []).map(s => side(s));
  const T = Q.tour; let prev = T && T.pre;
  R.tour = T ? T.steps.map(s => (prev = side({ npc: T.npc || Q.npc, lvl: T.lvl, ...s, pre: [].concat(prev || [], s.pre || []), goals: s.goals || s.dungeons.map(d => ({ type: 'clear', dungeon: d })) }, { noQuick: true }))) : [];
}
function defineRegion(spec) {
  const out = REGIONS[spec.id] = { spec, monsters: [], bosses: [], objs: [], dungeons: Object.keys(spec.dungeons || {}), scenes: Object.keys(spec.scenes || {}), quests: [] };
  for (const [id, T] of Object.entries(spec.themes || {})) regionTheme(id, T);
  for (const [id, M] of Object.entries(spec.monsters || {})) { regionMonster(spec, id, M, false); (M.obj ? out.objs : out.monsters).push(id); }
  for (const [id, M] of Object.entries(spec.bosses || {})) { regionMonster(spec, id, M, true); out.bosses.push(id); }
  regionItems(spec);
  // 地下城 + 门 + 掉落表
  for (const [id, G] of Object.entries(spec.dungeons || {})) {
    const L = REGION_LAYOUT[G.layout || 'standard'], lvl = G.lvl || [spec.lvl, spec.lvl + 1];
    defineDungeon(id, { ...L, name: G.name, lvl, theme: G.theme, rooms: G.rooms ?? L.rooms, mobs: G.mobs, elite: G.elite, boss: { kind: G.boss, lvl: G.bossLvl ?? lvl[1] + 1 }, bossAdds: G.bossAdds ?? 2,
      clearExp: G.clearExp ?? Math.round(540 * lvl[1]), bgm: G.bgm || 'dungeon', bossBgm: G.bossBgm, desc: G.desc, hidden: G.hidden, unlock: G.unlock, region: spec.id,
      bossTheme: G.bossTheme, bossProps: G.bossProps, bossAlt: G.bossAlt });   // 领主房单独的背景 / 摆设 / 稀有领主替换（game/dungeon.js）
    if (typeof GATE_ART !== 'undefined' && G.gate) GATE_ART[id] = { portal: [0.5, 0.58, 0.16, 0.3], col: G.gate.col || '200,140,255' };
    if (G.drops) defineDropTable(id, G.drops);
    // 通往领主房的前一个房间：保证刷出一只（精英）怪（任务 / 剧情要打的）
    if (G.preBoss) bus.on('roomEnter', d => {
      const Dg = game.dungeon; if (d.id !== id || !Dg || Dg.msPreBoss || d.type === 'boss' || !d.room || !Object.values(d.room.doors || {}).some(r => r.type === 'boss')) return;
      Dg.msPreBoss = true;
      spawnMonster(G.preBoss.kind, (game.room ? game.room.x1 : 1400) * 0.62, DEPTH / 2, { lvl: lvl[1], elite: G.preBoss.elite !== false, ...skyMul() });
      if (G.preBoss.say) game.after(0.8, () => toastMsg(G.preBoss.say, '#e0b0ff'));
    });
  }
  // NPC / 场景（区域地图的门按 dungeons[*].gate 自动摆）/ 入口
  for (const [id, N] of Object.entries(spec.npcs || {})) defineNpc(id, { art: 'world/npc_' + id, ...regionStrip(N) });
  for (const [id, S] of Object.entries(spec.scenes || {})) {
    const gates = Object.entries(spec.dungeons || {}).filter(([, G]) => G.gate && (G.gate.scene || id) === id && S.kind === 'field').map(([did, G]) => ({ dungeon: did, x: G.gate.x }));
    defineScene(id, { ...regionStrip(S), gates: [...(S.gates || []), ...gates] });
  }
  const E = spec.entry, ES = E && SCENES[E.scene];
  if (ES && !ES.exits.some(x => x.to === E.to)) ES.exits.push({ side: E.side, x: E.x, to: E.to, minLv: E.minLv, label: E.label });
  out.quests = regionQuests(spec);
  return out;
}
// 技能库样品怪：每种技能各一招（默认参数），test/region.mjs 用 monForceSkill 逐个放一遍
const MS_LAB_SPECS = { summon: { use: 'summon', kind: 'msCrystal', n: 1 }, seq: { use: 'seq', steps: [{ use: 'blink', to: 'behind' }, { use: 'swipe', n: 2 }] }, mech: { use: 'mech', mech: { use: 'shield', hp: 0.02 } }, explode: { use: 'explode', suicide: false }, guard: { use: 'guard', dur: 1.2 },
  hold: { use: 'hold', dur: 1 }, leap: { use: 'leap', track: 0.6, fall: 0.5 }, lanes: { use: 'lanes', lanes: 3, hit: 2, windup: 0.8 }, mark: { use: 'mark', delay: 1, r: 90 }, plant: { use: 'plant', n: 2, fuse: 1.2, r: 80 }, pool: { use: 'pool', zone: 'poison', windup: 0.6, linger: 2 }, pull: { use: 'pull', r: 300, dur: 1 } };
// 同一个技能的变体（冲刺的 carry / spin / bounces + wallStun / frac、标记的其它结算方式、残留区的轨迹）也放一遍，招式 id 标出来
const MS_LAB_EXTRA = [{ use: 'dash', id: 'dashCarry', carry: true }, { use: 'dash', id: 'dashSpin', spin: true, len: 260 }, { use: 'dash', id: 'dashBounce', bounces: 1, wallStun: 1 }, { use: 'dash', id: 'dashFrac', frac: 0.2 },
  { use: 'mark', id: 'markShare', mode: 'share', delay: 1 }, { use: 'cone', id: 'coneSweep', sweep: 60, ang: 40 }, { use: 'lanes', id: 'lanesRunner', kind: 'runner', runner: 'msLab', lanes: 3, hit: 2, windup: 0.8 }, { use: 'pool', id: 'poolTrail', trail: true, zone: 'oil', dur: 2 }];
MON.msLab = { name: '技能样品', lvl: 30, hp: 9000, atk: 270, def: 500, w: 13, d: 12, h: 96, weight: 1.2, speed: 90, exp: 0, gold: [0, 0], shadowR: 17, pref: 80, clips: BEAST_CLIPS, model: regionLook(), onSpawn: msOnSpawn, onDamaged: msOnDamaged, msTraits: {}, attacks: [] };
MON.msLab.attacks = [...Object.keys(MON_SKILLS).map(id => monSkill(MS_LAB_SPECS[id] || { use: id }, MON.msLab)), ...MS_LAB_EXTRA.map(s => monSkill(s, MON.msLab))];
