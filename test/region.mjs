// 区域流水线的通用测试：node test/region.mjs <区域 id> [部分,...]
//   data     数据完整性（怪物 / 主题 / 精灵 / 背景 / 门 / 掉落 / 图标 / 任务链 / 内容校验）
//   skills   技能库：样品怪把每个技能都放一遍（含格挡反击、抓取）
//   mechs    领主机制库：破招、无敌阶段（水晶 / 撑过）、护盾、安全区、场地危害、狂暴、分身、属性切换、连线、自定义钩子、阶段切换
//   monsters 区域的每个怪物 / 领主：有逐帧精灵、会出手、每招都能放、能打死
//   scenes   每个场景能进、背景加载、出口能走通（含从已有世界接进来的入口）
//   quest    主线任务链从头做到尾
//   abyss    深渊派对（spec.abyss）：所有深渊的数据、进图扣票、封印之门 → 配置的几波 → 深渊领主（机制 / 循环机制）→ 保底 → 深渊宝藏翻牌
//   bot      机器人以区域等级（Lv30 全身 +12 史诗）通关每个地下城，统计用时 / 被击 / 死亡（BOT=abyss_<id>:sword 也能跑深渊；GEAR=base 只穿稀有装备、GEAR=rare 同级稀有 +7、GEAR=epic 同级最好的一套史诗 +7（ENH 改强化）、LV=等级，用来和老区域对照难度）
// 默认全跑；环境变量 SPEED（默认 3）、BOT=地下城:职业,...（覆盖机器人的分配）。截图在 test/shots/region_<id>/
// 整个测试只开一个无头浏览器（各部分用同一个页面换地址）
import { launch, URL_BASE } from './lib.mjs';
import { BEST_KIT_SRC } from './lib_bestkit.mjs';
import fs from 'fs';
const id = process.argv[2] || 'siroco';
const parts = (process.argv[3] || 'data,skills,mechs,monsters,scenes,quest,abyss,bot').split(',');
const out = `test/shots/region_${id}`; fs.mkdirSync(out, { recursive: true });
const speed = +(process.env.SPEED || 3);
let fail = 0;
const check = (ok, msg) => { if (!ok) { fail++; console.log('✗', msg); } return ok; };
const { browser, page, logs } = await launch({ width: 1280, height: 720 });
const open = async q => { await page.goto(`${URL_BASE}?${q}`); await page.waitForFunction(() => window.__READY, null, { timeout: 30000 }); await page.evaluate(s => { game.speedMul = s; }, speed); };
const wait = ms => page.waitForTimeout(ms);
const simWait = s => wait(Math.round(s * 1000 / speed) + 60);

await open('test&mute&mon=msLab');
const R = await page.evaluate(id => { const R = REGIONS[id]; if (!R) return null; return { monsters: R.monsters, bosses: R.bosses, dungeons: R.dungeons, scenes: R.scenes, quests: R.quests, entry: R.spec.entry, lvl: R.spec.lvl, lvlMax: R.spec.lvlMax ?? R.spec.lvl,
  shades: Object.keys(MON).filter(k => MON[k].region === id && MON[k].msShadeOf) }; }, id);
if (!R) { console.log(`✗ 没有区域 ${id}（src/content/regions/${id}.js 有没有加进 src/ORDER？）`); process.exit(1); }
const ALL = [...R.monsters, ...R.bosses, ...R.shades];
await page.evaluate(async kinds => { await loadBundles(monBundles(kinds)); }, [...ALL, 'msLab']);

/* ---------------- 1. 数据 ---------------- */
if (parts.includes('data')) {
  const errs = await page.evaluate(({ id, R }) => {
    const E = [], has = k => !!ASSET_SRC[k], sp = REGIONS[id].spec;
    for (const did of R.dungeons) {
      const D = DUNGEONS[did];
      for (const k of [...D.mobs.map(m => m[0]), D.elite, D.boss.kind]) { if (!MON[k]) E.push(`${did}: 未定义的怪物 ${k}`); else if (!MON_ART[k]) E.push(`${did}: ${k} 没有 MON_ART`); }
      if (!THEMES[D.theme] || !BG_GRADE[D.theme]) E.push(`${did}: 主题 ${D.theme} 缺少 THEMES / BG_GRADE`);
      for (const k of ['far', 'floor', 'edge']) if (!has(`bg/${D.theme}_${k}`)) E.push(`${did}: 缺少背景 bg/${D.theme}_${k}`);
      for (const b of monBundles([...D.mobs.map(m => m[0]), D.boss.kind, D.elite])) if (!Object.values(ASSET_BUNDLE).includes(b)) E.push(`${did}: 分包 ${b} 没有素材`);
      if (!(D.lvl[0] >= sp.lvl && D.lvl[1] <= (sp.lvlMax ?? sp.lvl + 3) && D.boss.lvl >= D.lvl[1])) E.push(`${did}: 等级 ${D.lvl} / 领主 ${D.boss.lvl} 超出区域等级 ${sp.lvl}~${sp.lvlMax ?? sp.lvl + 3}`);   // lvlMax：跨好几级的区域（60 版本区域）
      const T = DROP_TABLES[did]; if (!T) E.push(`${did}: 没有掉落表`); else for (const [k] of [...T.boss, ...T.mats]) if (!ITEMS[k]) E.push(`${did}: 掉落表里的 ${k} 不存在`);
      if (!Object.values(SCENES).some(S => S.gates.some(g => g.dungeon === did))) E.push(`${did}: 没有放进区域地图`);
    }
    for (const sid of R.scenes) {
      const S = SCENES[sid];
      for (const k of ['far', 'floor', 'edge']) if (!has(`bg/${S.theme}_${k}`)) E.push(`${sid}: 缺少背景 bg/${S.theme}_${k}`);
      for (const n of S.npcs) if (!NPCS[n.npc] || !has(NPCS[n.npc].art)) E.push(`${sid}: NPC ${n.npc} 缺少立绘`);
      for (const g of S.gates) if (!has(gateArt(DUNGEONS[g.dungeon]).art) || gateArt(DUNGEONS[g.dungeon]).art === 'world/b_gate') E.push(`${sid}: 门 ${g.dungeon} 没有专属美术`);
    }
    if (R.entry) { const ES = SCENES[R.entry.scene]; if (!ES || !ES.exits.some(x => x.to === R.entry.to)) E.push(`入口 ${R.entry.scene} → ${R.entry.to} 没接上`); }   // 远古地下城没有自己的场景 / 入口（门放在已有场景上）
    const I = sp.items || {};
    for (const k of [...(I.epics || []).map(e => e.key), ...(I.sets || []).flatMap(s => s.pieces.map(p => p.key))]) { if (!ITEMS[k]) E.push(`史诗 ${k} 没有定义`); else if (!has('icon/item_' + k)) E.push(`史诗 ${k} 没有图标`); }
    for (const q of I.quest || []) if (!has('icon/' + q.key)) E.push(`任务道具 ${q.key} 没有图标`);
    let prev = sp.story.pre;
    for (const q of R.quests) { const Q = QUESTS[q]; if (!Q) { E.push(`任务 ${q} 没有定义`); continue; } if (Q.pre[0] !== prev) E.push(`任务 ${q} 的前置是 ${Q.pre}，应该是 ${prev}`); prev = q; if (!NPCS[Q.npc] || !NPCS[Q.to]) E.push(`任务 ${q} 的 NPC 不存在`); }
    for (const k of Object.keys(MON).filter(k => MON[k].region === id)) for (const A of MON[k].attacks) if (!SPR_ANIMS.monster[A.clip] && !BEAST_CLIPS[A.clip]) E.push(`${k}: 片段 ${A.clip} 不存在`);
    E.push(...validateWorld().map(m => '内容校验：' + m));
    return E;
  }, { id, R });
  for (const e of errs) check(false, e);
  console.log(`数据：${errs.length ? errs.length + ' 个问题' : '通过'}（${R.monsters.length} 种怪物、${R.bosses.length} 个领主、${R.dungeons.length} 个地下城、${R.scenes.length} 个场景、${R.quests.length} 个主线任务）`);
}

// 公共：清场、玩家锁血
const reset = () => page.evaluate(() => {
  for (let i = ents.length - 1; i >= 0; i--) if (ents[i].team === 'e') ents.splice(i, 1);
  groundFx.length = 0; projs.length = 0; game.timers.length = 0;
  const p = game.player; p.x = 300; p.y = 100; p.z = 0; p.status = {}; p.invul = 0; p.dead = false; p.hp = p.hpMax; if (p.act) p.endAct(); p.setState('idle');
  window.__keep ??= setInterval(() => { if (window.__noKeep) return; const q = game.player; q.hp = q.hpMax; q.mp = q.mpMax; q.dead = false; }, 40);
  window.__noKeep = false;
});
await page.evaluate(() => { window.__tele = 0; const ot = telegraph; telegraph = o => { __tele++; return ot(o); }; });

/* ---------------- 2. 技能库 ---------------- */
if (parts.includes('skills')) {
  await reset();
  const L = await page.evaluate(() => MON.msLab.attacks.map(a => a.ms));
  const rows = [];
  for (let i = 0; i < L.length; i++) {
    const r0 = await page.evaluate(i => {
      for (let k = ents.length - 1; k >= 0; k--) if (ents[k].team === 'e' && ents[k].kind !== 'msLab') ents.splice(k, 1);
      const p = game.player; p.x = 300; p.y = 100; p.z = 0; if (p.heldBy) releaseHeld(p); if (p.act) p.endAct(); p.setState('idle'); p.face = 1; p.invul = 0; p.grabProt = 0; p.status = {};   // 上一个技能的起身无敌 / 抓取保护不能带到下一个
      let m = ents.find(e => e.kind === 'msLab' && !e.dead); if (!m) m = window.__lab = spawnMonster('msLab', 360, 100, { lvl: 30 });
      m.x = 360; m.y = 100; m.invul = 0; m.hp = m.hpMax; m.aiCd = 99; m.face = -1; groundFx.length = 0; window.__tele = 0; window.__held = 0;
      window.__heldT = setInterval(() => { if (game.player.st === 'held') __held = 1; }, 20);
      return { before: { ...MS_STATS.cast } };
    }, i);
    await page.evaluate(i => monForceSkill(__lab, i), i);
    if (L[i] === 'guard') { await simWait(0.3); await page.evaluate(() => applyHit(game.player, __lab, { dmg: 1, sure: true, knock: 10, stun: 0.1 }, {})); }
    await simWait(2.2);
    await page.screenshot({ path: `${out}/skill-${L[i]}.png` });
    const r = await page.evaluate(({ use, before }) => { clearInterval(__heldT); const now = MS_STATS.cast; return { cast: (now[use] || 0) - (before[use] || 0), tele: __tele, held: __held, counter: (now.aoe || 0) - (before.aoe || 0), adds: ents.filter(e => e.team === 'e' && e.kind === 'msCrystal' && !e.dead).length }; }, { use: L[i], before: r0.before });
    rows.push({ skill: L[i], ...r });
    check(r.cast > 0, `技能 ${L[i]} 没有放出来`);
    if (['dash', 'aoe', 'rain', 'laser', 'explode'].includes(L[i])) check(r.tele > 0, `技能 ${L[i]} 没有地面预警`);
    if (L[i] === 'guard') check(r.counter > 0, '格挡被打中后没有反击');
    if (L[i] === 'grab') check(r.held > 0, '抓取没有抓住玩家');
    if (L[i] === 'summon') check(r.adds > 0, '召唤没有召出小怪');
  }
  const missing = await page.evaluate(() => Object.keys(MON_SKILLS).filter(k => !MS_STATS.cast[k]));
  check(!missing.length, `技能库里没放过的技能：${missing}`);
  console.table(rows);
}

/* ---------------- 3. 领主机制 ---------------- */
if (parts.includes('mechs')) {
  await reset();
  const boss = R.bosses.find(b => b === 'siroco') || R.bosses.find(b => R.shades.includes(b + 'Shade')) || R.bosses[R.bosses.length - 1];   // 分身机制要用领主的暗影：挑一个有暗影的
  const fresh = () => page.evaluate(boss => {
    for (let k = ents.length - 1; k >= 0; k--) if (ents[k].team === 'e') ents.splice(k, 1);
    groundFx.length = 0; game.timers.length = 0; const p = game.player; p.x = 300; p.y = 100; p.invul = 0; if (p.heldBy) releaseHeld(p);
    const m = window.__b = spawnMonster(boss, 900, 100, { lvl: MON[boss].lvl, boss: true }); m.invul = 0;
    m.control = (m, dt) => { m.aiCd = 99; regionAI(m, dt); };   // 只跑机制，不出招
    return m.msMechs.map(s => s.id);
  }, boss);
  const clearMechs = () => page.evaluate(() => { const m = __b; for (const s of m.msMechs) msMechEnd(m, s); m.msMechs = []; m.msMul = {}; m.dmgTakenMul = 1; if (m.gaze) m.gaze.next = 999; for (const e of ents) if (e.team === 'e' && e !== m && !e.dead) e.remove = true; });   // 领主出场自带的连线搭档之类也清掉，免得干扰下一项
  const hit = (dmg = 20, who = '__b') => page.evaluate(({ dmg, who }) => { const t = window[who]; t.invul = 0; return applyHit(game.player, t, { dmg, sure: true, knock: 0, stun: 0.05, hs: 0 }, { proj: true }); }, { dmg, who });
  const S = {};
  // 破招槽
  await fresh();
  S.groggy = await page.evaluate(async () => { const m = __b, st = m.msMechs.find(s => s.id === 'groggy'); let n = 0; while (!(st.stun > 0) && n++ < 3000) { m.invul = 0; applyHit(game.player, m, { dmg: 20, sure: true, knock: 0, stun: 0.05, hs: 0 }, { proj: true }); } return { hits: n, stun: st.stun, broke: MS_STATS.mech.groggyBreak || 0 }; });
  await simWait(0.2);
  S.groggy.mul = await page.evaluate(() => __b.msMul.groggy);   // 只看破招这一项（领主出场自带连线等机制时总倍率会再乘别的）
  check(S.groggy.stun > 0 && S.groggy.broke > 0 && S.groggy.mul > 1, `破招槽没有破：${JSON.stringify(S.groggy)}`);
  // 无敌阶段：水晶（领主藏起来 → 打碎水晶 → 现身）
  await clearMechs();
  await page.evaluate(() => { window.__st = msMechStart(__b, { use: 'invuln', until: 'crystals', n: 2, name: '记忆碎片' }); });
  await simWait(0.3);
  const inv1 = await page.evaluate(() => ({ hidden: !!__b.msHidden, inEnts: ents.includes(__b), n: __st.objs.length }));
  await page.evaluate(() => { for (const o of __st.objs) { o.invul = 0; o.st = 'idle'; o.z = 0; o.hp = 1; applyHit(game.player, o, { dmg: 50, sure: true }, { proj: true }); } });
  await simWait(0.5);
  const inv2 = await page.evaluate(() => ({ hidden: !!__b.msHidden, inEnts: ents.includes(__b), ended: !!__st.ended }));
  S.invulnCrystals = { inv1, inv2 };
  check(inv1.hidden && !inv1.inEnts && inv1.n === 2 && !inv2.hidden && inv2.inEnts && inv2.ended, `无敌阶段（水晶）不对：${JSON.stringify(S.invulnCrystals)}`);
  // 无敌阶段：撑过 N 秒（留在原地，伤害无效）
  await clearMechs();
  await page.evaluate(() => { window.__st = msMechStart(__b, { use: 'invuln', until: 'survive', survive: 1.0 }); });
  await simWait(0.2);
  const hp0 = await page.evaluate(() => __b.hp); await hit(40); const hp1 = await page.evaluate(() => ({ hp: __b.hp, mul: __b.dmgTakenMul }));
  await simWait(1.2); const surv = await page.evaluate(() => ({ ended: !!__st.ended, mul: __b.dmgTakenMul }));
  S.invulnSurvive = { hp0, hp1, surv };
  check(hp1.hp === hp0 && hp1.mul === 0 && surv.ended && surv.mul === 1, `无敌阶段（撑过）不对：${JSON.stringify(S.invulnSurvive)}`);
  // 可破护盾
  await clearMechs();
  await page.evaluate(() => { window.__st = msMechStart(__b, { use: 'shield', hits: 3 }); });
  const sh0 = await page.evaluate(() => __b.hp); await hit(20);
  const sh1 = await page.evaluate(() => ({ hp: __b.hp, left: __st.hp, max: __st.max }));
  await page.evaluate(() => { let n = 0; while (!__st.done && n++ < 2000) { __b.invul = 0; applyHit(game.player, __b, { dmg: 30, sure: true, knock: 0, stun: 0.05, hs: 0 }, { proj: true }); } });
  await simWait(0.2); const sh2 = await page.evaluate(() => ({ broken: !!__st.broken, ended: !!__st.ended }));
  S.shield = { sh0, sh1, sh2 };
  check(sh1.hp === sh0 && sh1.left < sh1.max && sh2.broken && sh2.ended, `护盾不对：${JSON.stringify(S.shield)}`);
  // 安全区：站在光圈里没事，站在外面挨打
  for (const inside of [true, false]) {
    await clearMechs();
    await page.evaluate(inside => { window.__noKeep = true; const p = game.player; p.hp = p.hpMax; p.invul = 0; p.status = {}; if (p.act) p.endAct(); p.setState('idle');
      window.__st = msMechStart(__b, { use: 'safezone', windup: 1.0, n: 1, r: 80, frac: 0.3 }); const z = __st.zones[0];
      p.x = inside ? z.x : (z.x > 700 ? 150 : 1300); p.y = inside ? z.y : 100; p.vx = p.vy = 0; }, inside);
    await page.screenshot({ path: `${out}/mech-safezone-${inside ? 'in' : 'out'}.png` });
    await simWait(1.3);
    const r = await page.evaluate(() => { const p = game.player; const r = { hp: p.hp, max: p.hpMax, safe: MS_STATS.mech.safe || 0 }; window.__noKeep = false; return r; });
    S['safezone_' + (inside ? 'in' : 'out')] = r;
    check(inside ? r.hp === r.max : r.hp < r.max, `安全区${inside ? '里面还挨打了' : '外面没挨打'}：${JSON.stringify(r)}`);
  }
  // 场地危害：地火出预警、场地缩小
  await clearMechs();
  await page.evaluate(() => { groundFx.length = 0; window.__st = msMechStart(__b, { use: 'hazard', kind: 'fire', every: 0.3, n: 2 }); });
  await simWait(2.0); S.hazardFire = await page.evaluate(() => { const n = groundFx.length + __tele; msMechEnd(__b, __st); return n; });
  check(S.hazardFire > 0, '场地危害（地火）没有预警');
  await page.evaluate(() => { window.__st = msMechStart(__b, { use: 'hazard', kind: 'shrink', speed: 300, minW: 600 }); window.__w0 = __st.w; });
  await simWait(0.8); S.hazardShrink = await page.evaluate(() => ({ w0: __w0, w: __st.w }));
  check(S.hazardShrink.w < S.hazardShrink.w0, `场地没有缩小：${JSON.stringify(S.hazardShrink)}`);
  // 狂暴计时
  await clearMechs();
  await page.evaluate(() => { window.__st = msMechStart(__b, { use: 'enrage', t: 0.4 }); window.__atk0 = __b.atk; });
  await simWait(0.8); S.enrage = await page.evaluate(() => ({ fired: !!__st.fired, cd: __b.msCdMul, atk: __b.atk > __atk0 }));
  check(S.enrage.fired && S.enrage.cd < 1 && S.enrage.atk, `狂暴计时没有触发：${JSON.stringify(S.enrage)}`);
  // 分身：打中本体 → 分身散掉；打分身 → 惩罚（区域里没有带分身的领主就跳过：分身要用领主自己的暗影）
  if (R.shades.includes(boss + 'Shade')) {
  await clearMechs();
  await page.evaluate(() => { window.__st = msMechStart(__b, { use: 'clones', n: 2, dur: 30 }); });
  await simWait(0.6);
  const c1 = await page.evaluate(() => __st.shades.filter(o => !o.dead && !o.remove).length);
  await hit(10); await simWait(0.3);
  const c2 = await page.evaluate(() => ({ ended: !!__st.ended, left: __st.shades.filter(o => !o.dead && !o.remove).length }));
  await page.evaluate(() => { window.__st = msMechStart(__b, { use: 'clones', n: 2, dur: 30 }); window.__p0 = MS_STATS.mech.clonePunish || 0; });
  await simWait(0.6);
  await page.evaluate(() => { const o = __st.shades[0]; o.invul = 0; o.st = 'idle'; o.z = 0; o.hp = 1; applyHit(game.player, o, { dmg: 50, sure: true }, { proj: true }); });
  await simWait(0.3); const c3 = await page.evaluate(() => (MS_STATS.mech.clonePunish || 0) - __p0);
  S.clones = { spawned: c1, afterHit: c2, punish: c3 };
  check(c1 === 2 && c2.ended && c2.left === 0 && c3 > 0, `分身机制不对：${JSON.stringify(S.clones)}`);
  }
  // 属性切换：站错位置伤害打折，站进相克的法阵里全额
  await clearMechs();
  await page.evaluate(() => { const p = game.player; if (p.act) p.endAct(); p.x = (game.room.x1) / 2; p.y = 100; p.z = 0; p.vx = p.vy = p.vz = 0; p.setState('idle'); window.__st = msMechStart(__b, { use: 'element', mul: 0.3, every: 999 }); });
  await simWait(0.3); const e1 = await page.evaluate(() => __b.dmgTakenMul);
  await page.evaluate(() => { const z = __st.zones.find(z => z.md !== __st.p.modes[__st.mode]); const p = game.player; if (p.act) p.endAct(); p.x = z.x; p.y = z.y; p.z = 0; p.vx = p.vy = p.vz = 0; p.setState('idle'); });
  await simWait(0.3); const e2 = await page.evaluate(() => __b.dmgTakenMul);
  S.element = { wrong: e1, right: e2 };
  check(Math.abs(e1 - 0.3) < 1e-6 && e2 === 1, `属性切换不对：${JSON.stringify(S.element)}`);
  // 连线：搭档活着伤害 ×0.35，搭档倒下 → 连线断 + 破招
  await clearMechs();
  await page.evaluate(() => { const p = game.player; p.x = 300; window.__st = msMechStart(__b, { use: 'tether', kind: 'luxi', mul: 0.35, onBreak: 'groggy' }); msMechStart(__b, { use: 'groggy', max: 100 }); window.__g0 = MS_STATS.mech.groggyBreak || 0; });
  await simWait(0.6); const t1 = await page.evaluate(() => __b.dmgTakenMul);
  await page.evaluate(() => { const o = __st.pt; o.invul = 0; o.st = 'idle'; o.z = 0; o.hp = 1; applyHit(game.player, o, { dmg: 50, sure: true }, { proj: true }); });
  await simWait(0.4); const t2 = await page.evaluate(() => ({ ended: !!__st.ended, groggy: (MS_STATS.mech.groggyBreak || 0) - __g0 }));
  S.tether = { mul: t1, ...t2 };
  check(Math.abs(t1 - 0.35) < 1e-6 && t2.ended && t2.groggy > 0, `连线机制不对：${JSON.stringify(S.tether)}`);
  // 自定义钩子（希洛克的凝视）：面朝她挨打，背对她没事
  const hasGaze = await page.evaluate(() => !!__b.gaze);
  if (hasGaze) for (const facing of [true, false]) {
    await clearMechs();
    await page.evaluate(facing => { window.__g = { hit: MS_STATS.mech.gazeHit || 0, safe: MS_STATS.mech.gazeSafe || 0 }; const p = game.player; p.x = 500; p.y = 100; __b.x = 800; __b.y = 100; p.face = facing ? 1 : -1; __b.gaze.next = 0; __b.gaze.warn = 0;
      window.__faceT = setInterval(() => { game.player.face = facing ? 1 : -1; }, 20); }, facing);
    await simWait(2.4);
    const g = await page.evaluate(() => { clearInterval(__faceT); return { hit: (MS_STATS.mech.gazeHit || 0) - __g.hit, safe: (MS_STATS.mech.gazeSafe || 0) - __g.safe }; });
    S['gaze_' + (facing ? 'facing' : 'back')] = g;
    check(facing ? g.hit > 0 : g.safe > 0 && g.hit === 0, `凝视（${facing ? '面朝' : '背对'}）不对：${JSON.stringify(g)}`);
  }
  // 阶段切换：血量降到阈值 → 进阶段、启动该阶段的机制
  await fresh();
  const ph = await page.evaluate(async () => {
    const m = __b, P = m.def_.msPhases || [], res = [];
    for (let i = 1; i < P.length; i++) { m.hp = Math.floor(m.hpMax * P[i].at) - 1; await new Promise(r => setTimeout(r, 400)); res.push({ want: i, got: m.msPhase, mechs: (m.msMechs || []).filter(s => !s.done).map(s => s.id) });
      if (m.msHidden) { for (const s of m.msMechs) if (s.id === 'invuln') for (const o of s.objs) { o.invul = 0; o.st = 'idle'; o.z = 0; o.hp = 1; applyHit(game.player, o, { dmg: 50, sure: true }, { proj: true }); } await new Promise(r => setTimeout(r, 400)); } }
    return res;
  });
  S.phases = ph;
  for (const r of ph) check(r.got === r.want, `阶段切换不对：${JSON.stringify(r)}`);
  console.log('领主机制：', JSON.stringify(S));
}

/* ---------------- 4. 怪物 / 领主 ---------------- */
if (parts.includes('monsters')) {
  await reset();
  const rows = [];
  for (const kind of ALL) {
    const isBoss = R.bosses.includes(kind);
    await page.evaluate(({ kind, isBoss }) => {
      for (let k = ents.length - 1; k >= 0; k--) if (ents[k].team === 'e') ents.splice(k, 1);
      groundFx.length = 0; projs.length = 0; game.timers.length = 0; window.__tele = 0; window.__acts = [];
      const p = game.player; p.x = 300; p.y = 100; p.status = {}; if (p.heldBy) releaseHeld(p); if (p.act) p.endAct(); p.setState('idle');
      const m = window.__m = spawnMonster(kind, 560, 100, { lvl: MON[kind].lvl, boss: isBoss }); m.invul = 0;
      const od = m.doAct.bind(m); m.doAct = (def, ex) => { __acts.push(def.name); return od(def, ex); };
    }, { kind, isBoss });
    const nAtk = await page.evaluate(() => __m.def_.attacks.length);
    const forced = [];
    if (isBoss) for (let i = 0; i < nAtk; i++) {
      forced.push(await page.evaluate(i => { const m = __m; if (m.msHidden) msHide(m, false); m.x = 560; return monForceSkill(m, i); }, i));
      await simWait(0.5); await page.screenshot({ path: `${out}/${kind}-a${i}.png` }); await simWait(1.6);
      await page.evaluate(() => { const m = __m; for (const s of m.msMechs || []) if (s.id !== 'groggy' && s.id !== 'enrage') msMechEnd(m, s); for (let k = ents.length - 1; k >= 0; k--) if (ents[k].team === 'e' && ents[k] !== __m) ents.splice(k, 1); if (m.msHidden) msHide(m, false); });
    }
    await page.evaluate(() => { __acts.length = 0; });
    await simWait(isBoss ? 5 : 4);
    await page.waitForFunction(() => __acts.length > 0, null, { timeout: 8000 }).catch(() => {});
    await page.screenshot({ path: `${out}/${kind}.png` });
    const r = await page.evaluate(() => {
      const m = __m, sprite = !!(m.def_.customModel || m.model && m.model.constructor && m.model.constructor.name === 'SpriteModel'), acted = __acts.length;   // customModel：手画的模型（远古的魔剑阿波菲斯）
      for (const s of m.msMechs || []) msMechEnd(m, s); m.msMechs = []; m.msMul = {}; m.dmgTakenMul = 1; if (m.msHidden) msHide(m, false); m.msShieldHp = 0;
      m.invul = 0; m.hp = 1; applyHit(game.player, m, { dmg: 50, sure: true }, { proj: true });
      return { hp: m.hpMax, atk: m.atk, sprite, acted, tele: __tele, dead: m.dead };
    });
    rows.push({ kind, boss: isBoss, ...r, forced: forced.filter(Boolean).length + '/' + (isBoss ? nAtk : '-') });
    check(r.dead, `${kind} 打不死`);
    check(r.sprite, `${kind} 没有逐帧精灵`);
    check(r.acted > 0, `${kind} 没有主动出手`);
    if (isBoss) { check(forced.every(Boolean), `${kind} 有的招式强制放不出来`); check(r.tele > 0, `${kind} 没有地面预警`); }
  }
  console.table(rows);
}

/* ---------------- 5. 场景 ---------------- */
if (parts.includes('scenes') || parts.includes('quest')) await open('town&mute&cls=sword');
if (parts.includes('scenes')) {
  await page.evaluate(L => { game.lvl = L; }, R.lvlMax);   // 区域的最高等级（区域里的出口可能有等级限制）
  const sceneNow = () => page.evaluate(() => world && world.S && world.S.id);
  for (const sid of R.scenes) {
    await page.evaluate(sid => enterScene(sid), sid); await wait(900);
    const r = await page.evaluate(() => ({ id: world.S.id, bg: !!IMG[`bg/${world.S.theme}_far`], npcs: world.S.npcs.map(n => !!IMG[NPCS[n.npc].art]).every(Boolean) }));
    await page.screenshot({ path: `${out}/scene-${sid}.png` });
    check(r.id === sid && r.bg && r.npcs, `场景 ${sid} 没进去 / 背景或 NPC 立绘没加载：${JSON.stringify(r)}`);
    for (let i = 0; i < (await page.evaluate(sid => SCENES[sid].exits.length, sid)); i++) {
      await page.evaluate(sid => enterScene(sid), sid); await wait(600);
      // 别的区域接到本区域场景上的入口（例：时空之门往上的魔界 Lv.60）可能高于本区域的等级：走这个出口时临时升到它的 minLv
      const to = await page.evaluate(([i, L]) => { const ex = world.S.exits[i]; game.lvl = Math.max(L, ex.minLv || 0); useExit(ex); return ex.to; }, [i, R.lvlMax]); await wait(900);
      check((await sceneNow()) === to, `场景 ${sid} 的第 ${i} 个出口走不到 ${to}`);
      const back = await page.evaluate(from => { const ex = world.S.exits.find(e => e.to === from); if (ex) useExit(ex); return !!ex; }, sid); await wait(900);
      check(back && (await sceneNow()) === sid, `从 ${to} 回不到 ${sid}`);
    }
  }
  // 从已有世界接进来的入口（例如天帷巨兽 · 脊背的次元裂缝）；远古地下城没有入口，门在已有场景上
  if (R.entry) {
  await page.evaluate(E => enterScene(E.scene), R.entry); await wait(700);
  await page.evaluate(E => useExit(world.S.exits.find(x => x.to === E.to)), R.entry); await wait(900);
  check((await sceneNow()) === R.entry.to, `入口 ${R.entry.scene} → ${R.entry.to} 走不通`);
  await page.evaluate(L => { game.lvl = L - 1; }, R.entry.minLv); await page.evaluate(E => enterScene(E.scene), R.entry); await wait(700);
  await page.evaluate(E => useExit(world.S.exits.find(x => x.to === E.to)), R.entry); await wait(700);
  check((await sceneNow()) === R.entry.scene, `入口的等级限制 Lv.${R.entry.minLv} 没拦住`);
  }
  await page.evaluate(L => { game.lvl = L; }, R.lvl);
  console.log('场景：完成');
}

/* ---------------- 6. 主线任务链 ---------------- */
if (parts.includes('quest')) {
  const res = await page.evaluate(async ({ id, R }) => {
    const sp = REGIONS[id].spec; game.lvl = sp.lvlMax ?? R.lvl; const d = save.data; d.questDone ??= {}; d.questDone[sp.story.pre] = Date.now();
    const rows = [];
    for (const q of R.quests) {
      const Q = QUESTS[q], s0 = questState(q); questAccept(q); const s1 = questState(q);
      Q.goals.forEach((g, i) => {
        if (g.type === 'reach') enterScene(g.scene);
        else if (g.type === 'talk') bus.emit('npcTalk', { id: g.npc });
        else if (g.type === 'clear') bus.emit('dungeonClear', { id: g.dungeon, diff: g.diff || 0, rank: 'S', time: 100, hurt: 0, maxCombo: 10 });
        else if (g.type === 'kill') bus.emit('kill', { kind: g.kind, boss: !!g.boss, elite: false, dungeon: g.dungeon, lvl: R.lvl, x: 0, y: 0 });
        else if (g.type === 'collect') questProgress(q, i, g.n);
      });
      await new Promise(r => setTimeout(r, 900));
      const ready = questReady(q); if (ready) questComplete(q);
      rows.push({ q, name: Q.name, before: s0, accepted: s1, ready, done: !!d.questDone[q] });
    }
    return { rows, reward: inv.count ? inv.count(sp.story.steps[sp.story.steps.length - 1].reward.items?.[0]?.key || '') : null };
  }, { id, R });
  console.table(res.rows);
  for (const r of res.rows) check(r.done, `任务 ${r.q} ${r.name} 没有完成（${r.before} → ${r.accepted}，ready=${r.ready}）`);
}

/* ---------------- 8. 深渊派对（spec.abyss 块，content/abyss.js）---------------- */
if (parts.includes('abyss')) {
  await open('town&mute&cls=sword'); await page.evaluate(() => { for (const w of ['help', 'guide']) if (menus.isOpen(w)) menus.close(w); });
  // 数据：本区域的深渊 + 所有深渊（含老区域的 ABYSS_LEGACY）
  const errs = await page.evaluate(id => {
    const E = [], has = k => !!ASSET_SRC[k];
    for (const [aid, A] of Object.entries(ABYSS)) {
      const D = DUNGEONS[aid], Q = QUESTS[A.quest], S = SCENES[A.scene];
      if (!D || !D.abyss || !D.hidden) { E.push(`${aid}: 不是隐藏的深渊地下城`); continue; }
      if (!Q || !NPCS[Q.npc] || !(Q.goals[0] && DUNGEONS[Q.goals[0].dungeon])) E.push(`${aid}: 资格任务 ${A.quest} 不完整`);
      if (!S || !S.gates.some(g => g.dungeon === aid)) E.push(`${aid}: 门没有放进 ${A.scene}`);
      for (const k of A.lords) if (!MON[k] || !MON_ART[k] && !MON[k].model) E.push(`${aid}: 深渊领主 ${k} 不存在`);
      for (const W of A.waves) for (const k of [...(W.mobs || []).map(m => m[0]), ...(W.elites || [])]) if (!D.mobs.some(m => m[0] === k)) E.push(`${aid}: 派对的怪 ${k} 没进地下城的怪物表（精灵不会加载）`);
      for (const M of [...A.lord.mechs, ...A.lord.cycle.map(c => c.mech)]) if (!BOSS_MECHS[M.use]) E.push(`${aid}: 领主机制 ${M.use} 不存在`);
      if (!has(`bg/${D.theme}_far`)) E.push(`${aid}: 背景 ${D.theme} 没有借到图`);
      if (A.region && !abyssPool(A).length) E.push(`${aid}: 区域 ${A.region} 没有深渊专属史诗`);
      for (const k of abyssPool(A)) if (!has('icon/item_' + k)) E.push(`${aid}: 深渊专属 ${k} 没有图标`);
    }
    if (!(REGIONS[id].abyss || []).length) E.push(`区域 ${id} 没有 abyss 块`);
    return E;
  }, id);
  for (const e of errs) check(false, e);
  // 找得到深渊：开放提示 + 自动前往、总览（不找 NPC 也能看）+ 前往门口、世界地图标记、不限购、普通地下城的邀请函掉率
  const disc = await page.evaluate(async () => {
    const r = {}, d = save.data, A0 = Object.values(ABYSS).find(A => !(QUESTS[A.quest].pre || []).length), q = A0.quest;
    delete d.questDone[q]; delete (d.quests || {})[q]; abyssData().told = {}; game.lvl = Math.max(game.lvl, QUESTS[q].lvl); recalcStats(game.player);
    abyssNoticeCheck(); const note = document.getElementById('abynote');
    r.note = !!note && note.textContent.includes(QUESTS[q].name) && !!abyssData().told[q];
    note.querySelector('button').click(); const f1 = guide.focus(); r.goQuest = guide.pin === q && !!f1 && f1.npc === QUESTS[q].npc;
    menus.open('abyss'); await new Promise(res => setTimeout(res, 150));
    const rows = [...document.querySelectorAll('[data-win=abyss] [data-aby]')];
    r.rows = rows.length === Object.keys(ABYSS).length && rows.every(x => x.querySelector('.abygo') && /资格/.test(x.textContent));
    r.tabs = document.querySelectorAll('[data-win=abyss] .itab').length;
    d.questDone[q] = Date.now(); menus.close('abyss'); menus.open('abyss'); await new Promise(res => setTimeout(res, 150));
    document.querySelector(`[data-win=abyss] [data-aby="${A0.id}"] .abygo`).click(); const f2 = guide.focus();
    r.goGate = guide.abyGate === A0.id && !!f2 && f2.gate === A0.id; guide.abyGate = null; guide.auto = false;
    menus.open('worldmap'); await new Promise(res => setTimeout(res, 150));
    r.map = !!document.querySelector(`.wm-node[data-id="${A0.scene}"] .wm-aby`) && !!document.querySelector('[data-sk=abyov]'); menus.close('worldmap');
    game.gold = 1e7; const t0 = inv.count('abyss_ticket'); for (let i = 0; i < 7; i++) abyssBuyTicket(null); r.buy = inv.count('abyss_ticket') - t0;
    const D = Object.values(DUNGEONS).find(D => !D.abyss && !D.hidden && D.lvl[1] >= 20), dg = { def: D, diff: 0, D: DIFFS[0] }, n0 = drops.length; let n = 0;
    for (let i = 0; i < 400; i++) { drops.length = 0; abyssExtraDrops({ kind: 'x', boss: true, x: 100, y: 50, z: 0 }, dg); n += drops.filter(x => x.item && x.item.key === 'abyss_ticket').length; }
    drops.length = n0; r.bossRate = n / 400;
    return r;
  });
  check(disc.note && disc.goQuest, `深渊开放提示 + 自动前往接资格任务 ${JSON.stringify(disc)}`);
  check(disc.rows && disc.tabs === 2 && disc.goGate, '深渊总览（不找 NPC 也能打开）：每个深渊都有资格状态和“前往”，资格完成后“前往”走到深渊门口');
  check(disc.map, '世界地图上有深渊标记和“深渊派对总览”按钮');
  check(disc.buy === 7, `歌兰蒂斯的邀请函不限购（买了 ${disc.buy} 张）`);
  check(disc.bossRate > 0.45 && disc.bossRate < 0.65, `普通地下城领主掉邀请函约 55%（实测 ${disc.bossRate}）`);
  const AB = await page.evaluate(id => REGIONS[id].abyss, id);
  for (const aid of AB) {
    // 进图：扣 cost 张邀请函
    const e0 = await page.evaluate(aid => {
      const A = ABYSS[aid], Q = QUESTS[A.quest]; save.data.questDone[A.quest] = Date.now(); const L = DUNGEONS[aid].lvl[0]; game.lvl = L; testLoadout(L); recalcStats(game.player);
      inv.items = inv.items.filter(x => x.kind !== 'equip'); inv.take('abyss_ticket', inv.count('abyss_ticket')); inv.add(makeItem('abyss_ticket', A.cost + 1)); save.data.fatigue = 999;
      abyssData().pity[aid] = A.pity - 1;
      const ok = enterDungeon(aid, 0);
      return { ok, cost: A.cost, pity: A.pity, quest: Q.name, npc: Q.npc };
    }, aid);
    await page.waitForFunction(aid => game.scene === 'dungeon' && game.dungeon && game.dungeon.def.id === aid, aid, { timeout: 20000 });
    await wait(300);
    const e1 = await page.evaluate(() => { const dg = game.dungeon; return { tk: inv.count('abyss_ticket'), lord: dg.def.abyssLord, boss: dg.def.boss.kind, room: !!dg.abyssRoom && dg.abyssRoom.type !== 'boss' && dg.abyssRoom.type !== 'start' }; });
    check(e0.ok && e1.tk === 1, `${aid}: 进图消耗 ${e0.cost} 张邀请函（剩 ${e1.tk}）`);
    check(e1.room && e1.lord && e1.boss, `${aid}: 深渊柱在一个普通房间，深渊领主 ${e1.lord}，领主房是 ${e1.boss}`);
    // 深渊柱所在的房间：打破深渊柱 → 第 1 轮深渊怪物 → 第 2 轮深渊精英 + 深渊领主；两轮打完之前门是锁着的
    await page.evaluate(() => { window.__keepA ??= setInterval(() => { const q = game.player; q.hp = q.hpMax; q.mp = q.mpMax; q.dead = false; }, 40); const dg = game.dungeon, p = game.player; p.invul = 1e9; const r = dg.abyssRoom; for (const o of dg.layout.rooms) if (o !== r && o.type !== 'boss') { o.visited = true; o.cleared = true; } dg.enter(r, 'left'); });
    await wait(500);
    const pil = await page.evaluate(() => { const dg = game.dungeon, s = ents.find(e => e.kind === 'abyssPillar'); return { pillar: !!s, phase: dg.abyssRun.phase, doors: dg.doorsOpen }; });
    check(pil.pillar && pil.phase === 'pillar' && !pil.doors, `${aid}: 深渊柱出现，门锁着`);
    await page.evaluate(() => { for (const e of [...ents]) if (e.team === 'e' && !e.dead && e.kind !== 'abyssBlock') { e.invul = 0; e.hp = 0; killEnt(e, game.player, {}); } drops.length = 0; });
    const seen = [];
    let lordIn = null;
    for (let i = 0; i < 60; i++) {
      await wait(300);
      const r = await page.evaluate(() => { const dg = game.dungeon, R = dg.abyssRun, kinds = []; let lord = null;
        for (const e of ents) if (e.team === 'e' && !e.dead && !e.remove && e !== R.block) { if (e.abyssLord) { lord = { kind: e.kind, boss: !!e.boss, name: e.name, mechs: (e.msMechs || []).map(s => s.id) }; continue; } if (e.abyssMob) kinds.push(e.kind + (e.elite ? '*' : '')); e.hp = 0; killEnt(e, game.player, {}); }
        drops.length = 0; return { ph: R.phase, round: R.round, kinds, lord, doors: dg.doorsOpen, cleared: dg.room.cleared }; });
      if (r.kinds.length) seen.push({ w: r.round, kinds: r.kinds });
      if (r.ph === 'round' && r.doors) { check(false, `${aid}: 深渊派对进行中门却开着`); break; }
      if (r.lord) { lordIn = r; break; }
    }
    const waveOk = await page.evaluate(({ aid, seen }) => { const A = ABYSS[aid], dg = game.dungeon; return seen.length >= 2 && seen.every(s => { const W = (s.w === 1 ? A.waves[0] : A.waves[A.waves.length - 1]) || {}, ok = new Set([...(W.mobs || dg.def.mobs).map(m => m[0]), ...(W.elites || []), dg.def.elite]); return s.kinds.every(k => ok.has(k.replace('*', ''))); }); }, { aid, seen });
    const want = await page.evaluate(aid => ABYSS[aid].lord.mechs.map(m => m.use), aid);
    check(!!lordIn && lordIn.round === 2 && lordIn.lord.boss && lordIn.lord.name.startsWith('深渊领主'), `${aid}: 第 2 轮深渊领主降临 ${JSON.stringify(lordIn && lordIn.lord)}`);
    check(waveOk, `${aid}: 两轮的怪物和配置一致 ${JSON.stringify(seen.map(s => s.w + ':' + [...new Set(s.kinds)].join('/')))}`);
    check(lordIn && want.every(u => lordIn.lord.mechs.includes(u)), `${aid}: 深渊领主带上了机制 ${want}`);
    await page.screenshot({ path: `${out}/abyss-${aid}-lord.png` });
    // 领主的循环机制（cycle）：撑 30 秒（游戏时间），至少触发一次
    const m0 = await page.evaluate(() => ({ ...MS_STATS.mech }));
    await page.evaluate(() => { const b = game.dungeon.abyssRun.lord; b.hp = Math.round(b.hpMax * 0.4); });
    await simWait(2);   // 领主自己的阶段可能会“隐入 / 钻地”（无敌阶段）：结束掉，让循环机制有机会出手
    await page.evaluate(() => { const b = game.dungeon.abyssRun.lord; for (const s of b.msMechs || []) if (s.id === 'invuln') { for (const o of s.objs || []) o.remove = true; msMechEnd(b, s); } if (b.msHidden) msHide(b, false); });
    await simWait(32);
    const m1 = await page.evaluate(() => ({ ...MS_STATS.mech }));
    const cyc = await page.evaluate(aid => ABYSS[aid].lord.cycle.map(c => c.mech.use), aid);
    check(!cyc.length || cyc.some(u => (m1[u] || 0) > (m0[u] || 0)), `${aid}: 领主的循环机制触发了（${cyc.map(u => `${u} ${(m0[u] || 0)}→${(m1[u] || 0)}`).join('，')}）`);
    // 保底：这一趟没出过史诗 + 已经连续 pity-1 次 → 深渊领主必掉本区域的深渊专属（压住随机数，让普通几率不出）；深渊领主死了不结算地下城
    const pity = await page.evaluate(aid => {
      const dg = game.dungeon, b = dg.abyssRun.lord, A = ABYSS[aid]; dg.abyssEpics = 0; drops.length = 0; b.invul = 0; for (const s of b.msMechs || []) msMechEnd(b, s);
      const R = Math.random; Math.random = () => 0.9; try { b.hp = 0; killEnt(b, game.player, {}); } finally { Math.random = R; }
      const ep = drops.filter(d => d.item && d.item.rar >= 5);
      const before = abyssData().pity[aid]; Math.random = () => 0.9; try { abyssExtraDrops({ kind: b.kind, abyssLord: true, x: b.x, y: b.y, z: 0 }, { def: dg.def, diff: 0, D: dg.D }); } finally { Math.random = R; }
      return { epics: ep.map(d => ({ key: d.item.key, abyss: !!d.abyss, own: ITEMS[d.item.key].abyssRegion === A.region })), after: before, next: abyssData().pity[aid], state: dg.state };
    }, aid);
    check(pity.epics.length >= 1 && pity.epics[0].abyss && pity.epics[0].own, `${aid}: 保底掉落本区域的深渊专属 ${pity.epics.map(e => e.key)}`);
    check(pity.after === 0 && pity.next === 1, `${aid}: 出了史诗保底清零，没出 +1（${pity.after} → ${pity.next}）`);
    check(pity.state === 'play', `${aid}: 打倒深渊领主不结算，地下城照常往下打（${pity.state}）`);
    // 两轮打完：原地弹出深渊宝藏（三张紫卡，免费翻一张），门打开
    await page.evaluate(() => { for (const e of [...ents]) if (e.team === 'e' && !e.dead && e !== game.dungeon.abyssRun.block) { e.hp = 0; killEnt(e, game.player, {}); } });
    await page.waitForFunction(() => { const dg = game.dungeon; return !!document.querySelector('#abytreasure .card') && dg.abyssRun.phase === 'done' && dg.doorsOpen; }, null, { timeout: 30000 }).catch(() => {});   // 并行负载下清房 / 开门会晚几帧
    await wait(500);
    const c0 = await page.evaluate(() => ({ n: document.querySelectorAll('#abytreasure .card').length, phase: game.dungeon.abyssRun.phase, round: game.dungeon.abyssRun.round, doors: game.dungeon.doorsOpen, alive: ents.filter(e => e.team === 'e' && !e.dead && !e.remove).map(e => e.kind), state: game.dungeon.state, items: inv.items.reduce((s, x) => s + (x.n || 1), 0), gold: game.gold }));
    if (!check(c0.n === 3 && c0.phase === 'done' && c0.doors, `${aid}: 两轮打完弹出三张「深渊宝藏」（${c0.n}），门打开了 ${JSON.stringify({ phase: c0.phase, round: c0.round, doors: c0.doors, alive: c0.alive, state: c0.state })}`)) continue;
    await page.screenshot({ path: `${out}/abyss-${aid}-treasure.png` });
    await page.click('#abytreasure .card >> nth=1'); await wait(900);
    const c1 = await page.evaluate(() => ({ flip: document.querySelectorAll('#abytreasure .card.flip').length, items: inv.items.reduce((s, x) => s + (x.n || 1), 0), gold: game.gold }));
    check(c1.flip === 3 && (c1.items > c0.items || c1.gold > c0.gold), `${aid}: 翻开一张拿到奖励，另外两张亮出来（物品 ${c0.items}→${c1.items}，金币 ${c0.gold}→${c1.gold}）`);
    // 领主房：普通领主，打倒才结算
    await page.evaluate(() => { const dg = game.dungeon; dg.enter(dg.layout.boss, 'left'); });
    await wait(600);
    const bs = await page.evaluate(() => { const dg = game.dungeon, b = dg.boss; return { kind: b && b.kind, abyss: !!(b && b.abyssLord), pillar: ents.some(e => e.kind === 'abyssPillar') }; });
    check(bs.kind === e1.boss && !bs.abyss && !bs.pillar, `${aid}: 领主房是普通的 ${bs.kind}`);
    await page.evaluate(() => { const b = game.dungeon.boss; for (const s of b.msMechs || []) msMechEnd(b, s); b.invul = 0; b.hp = 1; applyHit(game.player, b, { dmg: 50, sure: true }, { proj: true }); });
    await page.waitForFunction(() => menus.isOpen('result'), null, { timeout: 10000 }).catch(() => {});
    check(await page.evaluate(() => menus.isOpen('result')), `${aid}: 打倒领主房的领主 → 结算`);
    await page.evaluate(() => { menus.close('result'); lootAll(); return goTown(); }); await wait(500);
  }
  console.log(`深渊：${AB.join(', ')}（${errs.length ? errs.length + ' 个数据问题' : '数据通过'}）`);
}

/* ---------------- 7. 机器人通关（区域等级 全身 +12 史诗）---------------- */
if (parts.includes('bot')) {
  const CLS = ['sword', 'gun', 'mage'];
  const DUNGEONS_LV = await page.evaluate(ids => Object.fromEntries(ids.filter(d => DUNGEONS[d]).map(d => [d, DUNGEONS[d].lvl[1]])), [...R.dungeons, ...(process.env.BOT || '').split(',').map(x => x.split(':')[0])]);   // 机器人用各地下城自己的等级
  const plan = process.env.BOT ? process.env.BOT.split(',').map(s => s.split(':')) : R.dungeons.map((d, i) => [d, CLS[i % 3]]);
  const rows = [];
  for (const [did, cls] of plan) {
    await open(`town&mute&cls=${cls}`);
    if (process.env.GEAR === 'epic') await page.evaluate(BEST_KIT_SRC);
    const setup = await page.evaluate(({ did, lv, base, enh }) => {
      testLoadout(lv); const p = game.player, eq = [], A = typeof ABYSS !== 'undefined' && ABYSS[did], U = DUNGEONS[did].unlock;
      if (A) { save.data.questDone[A.quest] = Date.now(); inv.add(makeItem('abyss_ticket', A.cost)); }
      if (U && U.quest) save.data.questDone[U.quest] = Date.now();
      // GEAR=base：只有 testLoadout；GEAR=rare：全身同等级稀有 +ENH（默认 7，“等级合适的稀有装”）；GEAR=epic：同级最好的一套史诗 +ENH（和 gear60.mjs power 同一个搜索）；默认：全身史诗 +12
      if (base === 'epic') { const lv0 = game.lvl; game.lvl = lv; const K = g60BestKit(lv); game.lvl = lv0; for (const s in K.bestKit) { const it = K.bestKit[s]; it.enh = enh; inv.equip[s] = it; eq.push(it.rar); } }
      else if (base !== 'base') for (const s of Object.keys(SLOT_WEIGHT)) { const it = rollEquip({ slot: s, lvl: lv, rar: base === 'rare' ? 2 : 5, cls: p.cls }) || inv.equip[s]; if (it) { it.enh = base === 'rare' ? enh : 12; inv.equip[s] = it; eq.push(it.rar); } }
      recalcStats(p); p.hp = p.hpMax; p.mp = p.mpMax; save.data.fatigue = 999; bot.on = true; window.__botDone = null;
      enterDungeon(did, 0);
      return { epics: eq.filter(r => r === 5).length, slots: eq.length, atk: Math.round(p.atk || 0), hp: p.hpMax };
    }, { did, lv: +(process.env.LV || (DUNGEONS_LV[did] ?? R.lvl)), base: process.env.GEAR || '', enh: +(process.env.ENH || 7) });
    const limit = +(process.env.LIMIT || (did.includes('coffin') ? 900 : 600)), t0 = Date.now(); let done = null, n = 0, last = null;
    while (!done && (Date.now() - t0) / 1000 * speed < limit) {
      await wait(3000); done = await page.evaluate(() => window.__botDone || null);
      last = await page.evaluate(() => { const D = game.dungeon; return D ? { room: D.layout.rooms.indexOf(D.room), boss: D.room.type === 'boss', hp: Math.round(game.player.hp / game.player.hpMax * 100), bossHp: D.boss ? Math.round(D.boss.hp / D.boss.hpMax * 100) : null, phase: D.boss ? D.boss.msPhase : null, t: Math.round(D.t) } : null; });
      if (n++ % 8 === 0) { await page.screenshot({ path: `${out}/bot-${did}-${String(n).padStart(2, '0')}.png` }); console.log(did, cls, JSON.stringify(last)); }
    }
    await page.screenshot({ path: `${out}/bot-${did}-end.png` });
    const r = { dungeon: did, cls, ...setup, ...(done || { rank: 'TIMEOUT', last: JSON.stringify(last) }) };
    rows.push(r);
    check(!!done, `${did}（${cls}）机器人没有通关：${JSON.stringify(last)}`);
    if (done) { check(done.time <= limit, `${did} 用时 ${done.time}s 太长`); check(done.deaths <= 2, `${did} 死了 ${done.deaths} 次`); check(done.hurt <= 160, `${did} 被击 ${done.hurt} 次太多`); }
  }
  console.table(rows);
}

const errs = logs.filter(l => l.type !== 'warning' && !/素材加载失败/.test(l.text));
for (const e of errs.slice(0, 10)) console.log('ERR', e.text.slice(0, 300));
check(!errs.length, `页面报错 ${errs.length} 条`);
await browser.close();
console.log(fail ? `region ${id}: ${fail} 项失败` : `region ${id}: 全部通过`);
process.exit(fail ? 1 : 0);
