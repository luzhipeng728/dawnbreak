// 鬼剑士（男）官方对齐测试（docs/SKILLS_OFFICIAL_sword.md）：暂停游戏循环、逐帧推进，逐条验证
// 基础：三段刃 5 段、空之连刃空中连斩、后跳中银光落刃、月光斩追加、十字刃追加 / 可被取消、嗜魂之手通用且不回血、卡赞（剑影不能学）
// 剑魂：里·鬼剑术按武器段数、接回普攻、流心 X / Space / C 派生与落地回架势、三段刃 → 流心、拔刀斩打身后、逆转反击（被背击时 Z）、光剑冷却
// 狂战士：狂暴之力开关 + 二刀流 + 扣血、狂暴前置（没开时提示开启方法、自动放上快捷栏、图标高亮）、爆发之刃命中即爆可取消、血气旺盛出血、狂暴冷却、饥渴蓄力耗血。
// 遗留项（09-29）：鬼印珠抵消投射物、剑魂太刀 / 光剑三段刃 7 段、鬼神冠冕后的满月斩。node test/sword.mjs
import { launch, URL_BASE } from './lib.mjs';
let fail = 0;
const report = (name, ok, info) => { if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${JSON.stringify(info)}`); };
const { browser, page, logs } = await launch({ width: 960, height: 540 });
await page.goto(`${URL_BASE}?rawcd&test&cls=sword&mobs=0&mute`); await page.waitForFunction(() => window.__READY, null, { timeout: 30000 });
await page.evaluate(() => {
  game.paused = true;
  window.T = {
    run(n) { for (let i = 0; i < n; i++) step(1 / 60); },
    tap(a) { input.virt[a] = 2; T.run(1); delete input.virt[a]; },
    hold(a) { input.virt[a] = 1; }, press(a) { input.virt[a] = 2; }, release(a) { delete input.virt[a]; },
    clear() { for (const e of ents) if (e !== game.player) e.remove = true; T.run(1); projs.length = 0; },
    reset(p = game.player) { for (const k in input.virt) delete input.virt[k]; input.buf.length = 0; input.dirHist.length = 0;
      Object.assign(p, { x: 300, y: 100, z: 0, vx: 0, vy: 0, vz: 0, face: 1, act: null, invul: 0, superArmor: 0, hitstop: 0, dead: false, cool: {}, buffs: {}, charges: {}, bsCd: 0, reboundCd: 0, stun: 0, _backHitT: 0 });
      p.hp = p.hpMax; p.mp = p.mpMax; p.setState('idle'); resetCmb(p); p._psvT = 0; T.run(2); },
    mob(x = 400, y = 100) { const m = spawnMonster('goblin', x, y); m.control = null; m.invul = 0; m.z = 0; m.vz = 0; m.hp = m.hpMax = 1e9; m.setState('idle'); return m; },
    weapon(w) { inv.equip.weapon = w ? { wtype: w, slot: 'weapon' } : null; },
    job(j) { game.job = j; T.reset(); },
    bar(ids) { game.skillBar = ids.concat(Array(14).fill(null)).slice(0, 14); },
    cast(id) { const i = game.skillBar.indexOf(id); T.tap('s' + i); T.run(1); return game.player.act && game.player.act.skill; },
  };
  const L = game.skillLv; for (const id in SKILLS) if (SKILLS[id].cls === 'sword') L[id] = SKILLS[id].passive ? (SKILLS[id].maxLv || 1) : 5;
});
const R = await page.evaluate(() => {
  const out = {}, p = game.player; T.clear(); T.weapon('katana'); T.job(null);
  // ---- 基础 ----
  T.bar(['triple', 'moon', 'cross', 'soulhand', 'kazan', 'upslash']);
  T.reset(); T.cast('triple'); let names = []; for (let i = 0; i < 90; i++) { T.run(1); if (p.act && !names.includes(p.act.name)) names.push(p.act.name); if (p.act && p.actT > 0.12) T.tap('s0'); }
  out.triple = names.filter(n => n.startsWith('triple'));
  // 空之连刃：跳跃中连按 X 最多 3 斩（没学只有 1 斩）
  const air = () => { T.reset(); p.vz = p.jumpV; p.z = 0.5; p.airAtk = 0; p.setState('jump'); T.run(3); const seen = []; for (let i = 0; i < 70 && (p.z > 0.1 || i < 5); i++) { if (i % 8 === 0) T.tap('attack'); else T.run(1); if (p.act && !seen.includes(p.act.name)) seen.push(p.act.name); } T.run(20); return seen; };
  out.airOn = air(); game.skillLv.aircut = 0; out.airOff = air(); game.skillLv.aircut = 10;
  // 后跳中 Z：银光落刃
  T.reset(); T.hold('down'); T.tap('jump'); T.release('down'); T.run(6); T.tap('cmd'); T.run(1); out.backSilver = p.act && p.act.skill; T.run(80);
  // 月光斩：再按技能键追加上斩
  T.reset(); T.cast('moon'); T.run(10); T.tap('s1'); T.run(2); out.moon2 = p.act && p.act.name; T.run(60);
  // 十字刃：再按追加推击；后摇里可以被其他技能取消（links）
  T.reset(); T.cast('cross'); T.run(18); T.tap('s2'); T.run(2); out.cross2 = p.act && p.act.name; T.run(60);
  T.reset(); T.cast('cross'); T.run(22); T.tap('s5'); T.run(2); out.crossCancel = p.act && p.act.skill; T.run(60);
  // 嗜魂之手：通用技能（剑魂也能用），抓取后不回血
  T.job('blade'); T.clear(); p.hp = Math.round(p.hpMax * 0.5); let hp0 = p.hp; T.run(101); const regen = p.hp - hp0;   // 自然回血基线
  T.reset(); const m1 = T.mob(380, 100); p.hp = Math.round(p.hpMax * 0.5); hp0 = p.hp; out.soulCast = T.cast('soulhand'); T.run(100); out.soulHeal = p.hp - hp0 - regen; out.soulHitMob = m1.hp < 1e9; T.clear();
  // 卡赞：BUFF；剑影不能学
  T.reset(); T.cast('kazan'); T.run(40); out.kazan = !!p.buffs.kazan; out.kazanGhostblade = skillAllowed('kazan', 'ghostblade');
  // ---- 剑魂 ----
  T.bar(['rikiken', 'flow', 'iai', 'rise', 'triple', 'wm_edge']);
  const rk = w => { T.weapon(w); T.reset(); T.cast('rikiken'); const seen = []; for (let i = 0; i < 140; i++) { T.run(1); if (p.act && p.act.rk && !seen.includes(p.act.name)) seen.push(p.act.name); if (p.act && p.act.rk && p.actT > 0.14) T.tap('s0'); } return seen.length; };
  out.rkKatana = rk('katana'); out.rkGreat = rk('greatsword'); out.rkShort = rk('shortsword'); out.rkClub = rk('club'); T.weapon('katana');
  T.reset(); T.cast('rikiken'); T.run(10); T.tap('attack'); T.run(2); out.rkToBasic = p.act && p.act.name;  T.run(40);
  // 流心：X 刺、Space 狂（永久）、C 跃（不追加 → 落地回到架势）
  T.reset(); T.cast('flow'); T.run(12); T.tap('attack'); T.run(1); out.flowX = p.act && p.act.skill; T.run(60);
  T.reset(); T.cast('flow'); T.run(12); T.tap('cmdB'); T.run(1); out.flowSpace = p.act && p.act.skill; T.run(40); out.flowFrenzyT = p.buffs.flow_frenzy && Math.round(p.buffs.flow_frenzy.t);
  T.reset(); T.cast('flow'); T.run(12); T.tap('jump'); T.run(1); out.flowC = p.act && p.act.skill; for (let i = 0; i < 90 && !(p.act && p.act.flowStance); i++) T.run(1); out.leapBackToStance = !!(p.act && p.act.flowStance); T.run(10); T.tap('s1'); T.run(3); out.flowExit = !(p.act && p.act.flowStance);
  // 三段刃 → 流心（白名单）
  T.reset(); T.cast('triple'); T.run(8); T.tap('s1'); T.run(2); out.tripleToFlow = p.act && p.act.skill; T.run(40);
  // 拔刀斩：以自身为中心，身后的敌人也会被斩
  T.clear(); T.reset(); const behind = T.mob(230, 100); T.cast('iai'); T.run(80); out.iaiBehind = behind.hp < 1e9; T.clear();
  // 逆转反击：被背击后 1 秒内按 Z
  T.reset(); p._backHitT = game.t; p.setState('hit'); p.stun = 0.3; T.tap('cmd'); T.run(1); out.reverse = p.act && p.act.skill; T.run(60);
  // 光剑掌握：光剑时冷却 −10%
  T.weapon('lightsaber'); T.reset(); T.cast('rise'); out.riseCd = +(p.cool.rise || 0).toFixed(2); T.run(80); T.weapon('katana');
  // ---- 狂战士 ----
  T.job('berserker'); T.bar(['frenzy', 'bz_scratch', 'bloodblade', 'outrage', 'cross', 'bz_thirst', 'rampage']);
  T.reset(); out.scratchNoFrenzy = T.cast('bz_scratch') || null; T.run(30);
  out.needMsg = SKILLS.bz_scratch.req(p);   // 狂暴之力没开：提示里带开启方法（快捷栏按键 / 指令）
  { const B0 = game.skillBar.slice(); game.skillBar = Array(14).fill(null); game.skillBar[0] = 'upslash'; delete (save.data.flags ??= {}).bar_frenzy; swordGateBar(p); out.gateSlot = game.skillBar.indexOf('frenzy'); game.skillBar = B0; }
  T.reset(); const hpA = p.hp; T.cast('frenzy'); T.run(40); out.frenzyOn = !!p.buffs.frenzy; out.frenzyHl = !!(p.buffs.frenzy && p.buffs.frenzy.hl); out.frenzyCost = hpA - p.hp; T.run(20);
  T.tap('attack'); T.run(2); out.dualClip = p.act && p.act.clip; T.run(40);
  out.scratchFrenzy = T.cast('bz_scratch'); T.run(40);
  T.cast('outrage'); out.outrageCd = +(p.cool.outrage || 0).toFixed(2); T.run(60);
  // 爆发之刃：命中立即爆炸，命中后可以取消接怒气爆发
  T.clear(); const m2 = T.mob(400, 100); p.cool = {}; T.cast('bloodblade'); let boomAt = -1; for (let i = 0; i < 40; i++) { T.run(1); if (p.act && p.act.boom && boomAt < 0) boomAt = i; } T.tap('s3'); T.run(2); out.bladeBoomAt = boomAt; out.bladeCancel = p.act && p.act.skill; T.run(60);
  // 血气旺盛：十字刃附带出血
  T.clear(); game.skillLv.bz_limit = 0; const m3 = T.mob(360, 100); p.cool = {}; T.cast('cross'); T.run(40); out.crossBleed = !!(m3.status && m3.status.bleed); T.clear();
  game.skillLv.bz_limit = 10; const m3b = T.mob(400, 100); p.cool = {}; T.cast('cross'); T.run(40); out.crossLimit = !!(m3b.status && m3b.status.bleed); T.clear();   // 血气界限：交叉斩直接射出血十字
  // 饥渴：按住蓄力耗血
  T.reset(); const hpB = p.hp; T.press('s5'); T.run(2); T.hold('s5'); T.run(130); T.release('s5'); T.run(40); out.thirstHp = Math.round((hpB - p.hp) / p.hpMax * 100); out.thirstBuff = !!p.buffs.bz_thirst;
  // 再按一次狂暴之力：解除，普攻回到单刀
  T.reset(); p.buffs.frenzy = { t: 9999, atk: 0.1 }; p.acts = swordActs(p); T.cast('frenzy'); T.run(40); out.frenzyOff = !p.buffs.frenzy; T.run(20); T.tap('attack'); T.run(2); out.singleClip = p.act && p.act.clip;
  // ---- 阿修罗 ----
  T.job('asura'); T.bar(['as_mark', 'as_orb', 'as_evil', 'as_burst', 'as_aura', 'as_ice', 'as_musou', 'as_fudo', 'as_awaken', 'wave', 'as_fire']);
  T.reset(); out.orbNoMark = T.cast('as_orb') || null; T.run(20);
  T.cast('as_mark'); T.run(30); out.mark1 = asMarks(p); T.run(430); out.mark2 = asMarks(p);
  T.clear(); const m4 = T.mob(420, 100); p.cool = {}; out.orbCast = T.cast('as_orb'); T.run(20); out.markAfterOrb = asMarks(p); T.run(200); out.orbHit = m4.hp < 1e9; T.clear();
  // 冰刃 → 满蓄邪光斩
  p.cool = {}; T.cast('as_ice'); T.run(24); T.tap('s2'); T.run(2); out.evilLinked = p.act && p.act.skill; out.evilFull = !!(p.act && p.act.full); T.run(60);
  // 波动爆发：倒地时也能用
  T.reset(); p.buffs.as_mark = { t: 9999, n: 0, gen: 7 }; p.setState('down'); p.downTime = 2; T.tap('s3'); T.run(1); out.burstDown = p.act && p.act.skill; T.run(40);
  // 无双波需要无尽波动；无尽波动耗 MP、伤害周围敌人
  T.reset(); out.musouNoAura = T.cast('as_musou') || null; T.run(10);
  T.clear(); const m5 = T.mob(360, 100); p.cool = {}; T.cast('as_aura'); T.run(30); const mp0 = p.mp; T.run(120); out.auraMp = Math.round(mp0 - p.mp); out.auraHit = m5.hp < 1e9;
  out.musouAura = T.cast('as_musou'); T.run(120); T.clear();
  // 不动明王阵：消耗全部波动印
  p.cool = {}; p.buffs.as_mark = { t: 9999, n: 3, gen: 7 }; const m6 = T.mob(460, 100); out.fudo = T.cast('as_fudo'); T.run(2); out.markAfterFudo = asMarks(p); T.run(160); out.fudoHit = m6.hp < 1e9; T.clear();
  // 暗天波动眼：需要无尽波动；领域中地裂·波动剑 → 光翼；再按一次 → 天穹之眼，领域结束
  T.reset(); out.awkNoAura = T.cast('as_awaken') || null; p.cool = {};
  p.buffs.as_aura = { t: 9999, atk: 0.05, lv: 1, tick: 0 }; game.skillLv.as_awaken = 1; if (typeof awakenUnlocked === 'function') save.data.flags = { ...(save.data.flags || {}), awaken: true };
  T.cast('as_awaken'); T.run(150); out.domain = !!p.buffs.as_domain; T.run(10); T.cast('wave'); out.wing = p.act && p.act.skill; T.run(40);   // 觉醒有 0.9 秒定格
  T.cast('as_awaken'); T.run(40); out.domainEnd = !p.buffs.as_domain;
  // 指令 →→+Z：阿修罗是邪光斩（冷却更长的占用指令），不是嗜魂之手
  T.reset(); p.cool = {}; T.tap('right'); T.run(2); T.tap('right'); T.run(2); T.tap('cmd'); T.run(1); out.ffZ = p.act && p.act.skill; T.run(60);
  // ---- 鬼泣 ----
  T.clear(); T.job('soulbender'); T.bar(['sb_saya', 'sb_whip', 'sb_rasha', 'sb_plemon', 'sb_purge', 'sb_kaiga', 'sb_flash', 'sb_karo', 'sb_karoblade', 'kazan', 'ghost']);
  const m7 = T.mob(420, 100); T.reset(); T.cast('sb_saya'); T.run(40); out.sayaN = summonsOf(p, 'sb_saya_f').length; T.run(60); out.sayaHit = m7.hp < 1e9;
  p.cool = {}; T.cast('sb_saya'); T.run(40); out.sayaReplace = summonsOf(p, 'sb_saya_f').length;
  // 鬼神解放：鬼影鞭施放中按罗刹键，不打断动作直接放阵；没学鬼神解放时放不出来
  dismissSummons(p); T.reset(); p.cool = {}; T.cast('sb_whip'); T.run(6); T.tap('s2'); T.run(5); out.softAct = p.act && p.act.skill; out.softField = summonsOf(p, 'sb_rasha_f').length; T.run(60);   // 命中停顿中输入会顺延几帧
  game.skillLv.sb_release = 0; dismissSummons(p); T.reset(); p.cool = {}; T.cast('sb_whip'); T.run(6); T.tap('s2'); T.run(5); out.noSoftField = summonsOf(p, 'sb_rasha_f').length; T.run(60); game.skillLv.sb_release = 1;
  // 罗刹附身：踩进阵的敌人被附身，离开阵也不掉
  dismissSummons(p); T.clear(); const m8 = T.mob(400, 100); T.reset(); p.cool = {}; T.cast('sb_rasha'); T.run(60); out.rashaOn = summonsOf(p, 'sb_rasha_on').some(s => s.host === m8); m8.x = 900; T.run(60); out.rashaStay = summonsOf(p, 'sb_rasha_on').some(s => s.host === m8);
  // 普戾蒙：阵里的敌人受到伤害增加
  p.cool = {}; m8.x = 400; T.cast('sb_plemon'); T.run(60); out.plemon = !!(m8.buffs && m8.buffs.sb_plemon);
  // 泯灭仪式：清掉自己的阵
  T.cast('sb_purge'); T.run(20); out.purged = summonsOf(p, { tag: 'field' }).length; T.clear();
  // 残影之凯贾：跑动攻击变成凯贾冲刺斩，冲刺中可以接鬼影闪；平时放不出鬼影闪
  game.skillLv.sb_mastery = 0; T.reset(); out.flashNoKaiga = T.cast('sb_flash') || null; T.run(20);   // 二觉被动（御鬼之极）之前
  T.cast('sb_kaiga'); T.run(30); p._psvT = 0; T.run(2); p.face = 1; T.hold('right'); p.setState('run'); T.tap('attack'); T.release('right'); T.run(2);
  out.kaigaDash = !!(p.act && p.act.kaigaDash); T.cast('sb_flash'); out.flashKaiga = p.act && p.act.skill; T.run(80); game.skillLv.sb_mastery = 1;
  // 冥炎之卡洛：普攻改为发射分身（投射物），命中附加冥炎；冥炎剑只能在卡洛中施放
  T.clear(); T.reset(); out.bladeNoKaro = T.cast('sb_karoblade') || null; T.run(10); const m9 = T.mob(420, 100);
  T.cast('sb_karo'); T.run(30); p._psvT = 0; T.run(2); const pj0 = projs.length; T.tap('attack'); T.run(6); out.karoShot = projs.length > pj0; T.run(40); out.karoBurn = summonsOf(p, 'sb_karo_burn').some(s => s.host === m9);
  p.cool = {}; T.cast('sb_karo'); T.run(30); out.karoPurple = !!(p.buffs.sb_karo && p.buffs.sb_karo.purple);   // 再按一次切换紫焰（卡洛还在）
  p.cool = {}; out.bladeKaro = T.cast('sb_karoblade'); T.run(90); T.clear();
  // 卡赞：鬼泣转职后变被动（不能施放）
  T.reset(); out.kazanSb = T.cast('kazan') || null;
  // ---- 剑影 ----
  T.clear(); T.job('ghostblade'); T.bar(['gb_step', 'gb_chain', 'gb_issen', 'gb_rend', 'gb_riko', 'gb_ghostslash', 'gb_retrace', 'gb_fang', 'gb_break', 'gb_behead', 'gb_resonance', 'kazan']);
  // 鬼人化：普攻 4 段
  T.reset(); const gbSeen = []; T.press('attack'); for (let i = 0; i < 120; i++) { T.run(1); if (p.act && !gbSeen.includes(p.act.name)) gbSeen.push(p.act.name); } T.release('attack'); T.run(30); out.gbBasic = gbSeen.filter(n => /^atk/.test(n)).length;
  // 幻鬼：一闪 → 幻鬼现身出招、之后可以幻鬼步
  const m10 = T.mob(560, 100); T.reset(); T.cast('gb_issen'); T.run(20); const ph = gbPhantom(p); out.phantom = !!ph; out.phantomHit = m10.hp < 1e9; T.run(10);
  const px0 = p.x; T.cast('gb_retrace'); T.run(2); out.retrace = ph && Math.abs(p.x - ph.x) < 30 && Math.abs(p.x - px0) > 100; out.retraceInvul = p.invul > 0.3;   // 房间边缘会把人夹回一点
  T.run(90); out.phantomGone = !gbPhantom(p);
  // 幻鬼技能在剑术技能中无动作叠加
  T.reset(); p.cool = {}; T.cast('gb_chain'); T.run(6); T.tap('s3'); T.run(1); out.stackAct = p.act && p.act.skill; out.stackPhantom = !!gbPhantom(p); T.run(90);
  // 鬼步 + 剑术 = 鬼步形态（瞬移 + 路径伤害）
  T.clear(); const m11 = T.mob(480, 100); T.reset(); p.cool = {}; T.cast('gb_step'); T.run(10); const sx0 = p.x; T.tap('s1'); T.run(20); out.stepMoved = p.x - sx0 > 200; out.stepHit = m11.hp < 1e9; out.stepAct = p.act && p.act.name; T.run(60); T.clear();
  // 共鸣：离魂一闪（与已分离的幻鬼交换位置）
  T.reset(); p.cool = {}; T.cast('gb_issen'); T.run(25); const ph2 = gbPhantom(p), phx = ph2 && ph2.x, plx = p.x; T.cast('gb_riko'); T.run(3); out.rikoSwap = ph2 && Math.abs(p.x - phx) < 5 && Math.abs(ph2.x - plx) < 5; T.run(90);
  // 剑影不能学卡赞
  out.gbKazan = skillAllowed('kazan', 'ghostblade');
  // ---- P1（觉醒与 48–100 级技能）：每个转职的新主动技能逐个施放（满足前置条件），跑完不报错 ----
  const P1 = { blade: ['wm_meteor', 'wm_kuubatto', 'wm_hakuu', 'wm_shunzan', 'wm_awaken2', 'wm_mukei', 'wm_awaken3'],
    berserker: ['bz_awaken', 'bz_snatch', 'bz_crusher', 'bz_boom', 'bz_fatal', 'bz_awaken2', 'bz_rampant', 'bz_awaken3'],
    asura: ['as_ice2', 'as_fire2', 'as_indra', 'as_vajra', 'as_awaken2', 'as_mui', 'as_awaken3'],
    soulbender: ['sb_purgatory', 'sb_swamp', 'sb_blade', 'sb_descent', 'sb_awaken2', 'sb_ferry', 'sb_awaken3'],
    ghostblade: ['gb_naraku', 'gb_abyss', 'gb_shinpu', 'gb_dance', 'gb_awaken2', 'gb_mushiki', 'gb_awaken3'] };
  save.data.flags = { ...(save.data.flags || {}), awaken: true }; out.p1 = {};
  for (const job in P1) { T.clear(); T.job(job); for (const id of P1[job]) { T.reset(); p.cool = {}; p.buffs.frenzy = { t: 9999, atk: 0.1, lv: 1, tick: 10 }; p.buffs.as_aura = { t: 9999, atk: 0.05, lv: 1, tick: 0 };
    for (let i = 0; i < 3; i++) T.mob(380 + i * 50, 80 + i * 20); const ok = castSkill(p, id, false, 's0'); T.run(1); const got = !!(p.act && (p.act.skill === id)) || (SKILLS[id].instant && p.cool[id] > 0);
    T.run(260); out.p1[id] = ok && got; T.clear(); } }
  // 万剑归宗：召唤飞剑 → 普攻命中射出穿云刺 → 再按一次御剑术；暴风式和开天斩共享冷却
  T.job('blade'); T.reset(); p.cool = {}; const m12 = T.mob(380, 100); castSkill(p, 'wm_awaken2', false, 's0'); T.run(130); out.swords = summonsOf(p, 'wm_swords').length;
  const pj1 = projs.length; p.doAct(p.acts.atk1); T.run(12); out.thrust = projs.length > pj1 || summonsOf(p, 'wm_swords').length === 1; T.run(30); p.cool = {}; castSkill(p, 'wm_awaken2', false, 's0'); T.run(2); out.swordsEnd = summonsOf(p, 'wm_swords').length; T.run(120);
  T.reset(); p.cool = {}; castSkill(p, 'wm_awaken3', false, 's0'); T.run(2); out.awkShared = (p.cool.awaken || 0) > 100; T.run(260); T.clear();
  // 魔狱血刹（现版）：背后血剑 → 再按一次劈下
  T.job('berserker'); T.reset(); p.cool = {}; const mBz = T.mob(p.x + 60, p.y); castSkill(p, 'bz_awaken', false, 's0'); T.run(120); out.bloodSword = summonsOf(p, 'bz_bloodsword').length === 1 && !!p.buffs.bz_bloodsword;
  { const bs = summonsOf(p, 'bz_bloodsword')[0], b0 = bs ? bs.blood : -1; mBz.x = p.x + 60; mBz.y = p.y; p.doAct(p.acts.atk1); T.run(15); out.bloodAbsorb = !!bs && bs.blood > b0; }   // 攻击吸收血气
  p.cool.bz_awaken = 99; castSkill(p, 'bz_awaken', false, 's0'); T.run(2); out.bloodSwordFall = summonsOf(p, 'bz_bloodsword').length === 0; T.run(160);
  p.cool = {}; castSkill(p, 'bz_awaken', false, 's0'); T.run(120); castSkill(p, 'bz_awaken3', false, 's0'); T.run(2); out.awk3Finish = summonsOf(p, 'bz_bloodsword').length === 0 && !!p.act && p.act.skill === 'bz_awaken3'; T.run(300); T.clear();
  // 阿修罗：心眼挡下一次攻击；雷神之息让转职技能命中附带感电
  T.job('asura'); T.reset(); const m13 = T.mob(360, 100); m13.face = -1; const hpM = p.hp; out.mind = applyHit(m13, p, { dmg: 5 }, {}) === false && p.hp === hpM; out.mind2 = applyHit(m13, p, { dmg: 5 }, {}) !== false;
  T.reset(); p.cool = {}; p.buffs.as_mark = { t: 9999, n: 0, gen: 7 }; castSkill(p, 'as_burst', false, 's0'); T.run(30); out.thunderShock = !!(m13.status && m13.status.shock); T.clear();
  // 鬼泣：吉格降临处决 HP 低的普通怪物
  T.job('soulbender'); T.reset(); p.cool = {}; const m14 = T.mob(420, 100); m14.hp = m14.hpMax = 5e5; castSkill(p, 'sb_awaken2', false, 's0'); T.run(150); m14.hp = m14.hpMax * 0.2; T.run(90); out.jigExec = m14.dead || m14.hp <= 0; T.run(100); T.clear();
  // 剑影：无式·极影剑在鬼步中施放 = 鬼步形态
  T.job('ghostblade'); T.reset(); p.cool = {}; castSkill(p, 'gb_step', false, 's0'); T.run(10); castSkill(p, 'gb_mushiki', false, 's1'); T.run(1); out.mushikiStep = p.act && p.act.name; T.run(80); T.clear();
  // ---- 受击前钩子（combat.js beforeHurt）与新异常状态 ----
  const R0 = Math.random, fixR = v => { Math.random = () => v; }, relR = () => { Math.random = R0; };
  T.clear(); T.job('blade'); T.reset(); const atk = T.mob(360, 100); atk.face = -1;
  p.buffs.wm_autoguard = { t: 120, chance: 1, lv: 5 }; const hpG = p.hp; out.autoGuard = applyHit(atk, p, { dmg: 5, stun: 0.3 }, {}) === false && p.hp === hpG; T.run(40); delete p.buffs.wm_autoguard;
  // 格挡：魔法攻击的吸收率比物理低（物理 56%、魔法 35%，技能 5 级）
  const hitOnce = (type, guard) => { T.reset(); p.face = 1; if (guard) { p.cool = {}; castSkill(p, 'guard', false, 's0'); T.run(3); } fixR(0.99); const h0 = p.hp; applyHit(atk, p, { dmg: 3, type, sure: true }, {}); relR(); const d = h0 - p.hp; p.act = null; p.setState('idle'); return d; };
  T.bar(['guard']); const gp = hitOnce('phys', true) / hitOnce('phys', false), gm = hitOnce('mag', true) / hitOnce('mag', false); out.guardPhys = +gp.toFixed(2); out.guardMag = +gm.toFixed(2);
  // 感电：剑魂光剑（武器奥义）命中附带感电，之后再挨打会追加感电伤害
  T.weapon('lightsaber'); T.bar(['rikiken']); T.reset(); fixR(0.01); T.cast('rikiken'); T.run(12); relR(); out.shock = !!(atk.status && atk.status.shock); const s0 = atk._shockT;
  T.run(12); applyHit(p, atk, { dmg: 0.1, sure: true }, { proj: true }); out.shockProc = atk._shockT !== s0 && atk._shockT !== undefined; T.weapon('katana'); T.run(30);
  // 狂气涌动：HP 不会被打到 50% 以下，触发血盾后再挨打全部吸收
  T.job('berserker'); T.bar(['bz_surge']); T.reset(); p.cool = {}; castSkill(p, 'bz_surge', false, 's0'); T.run(2); out.surgeBuff = !!p.buffs.bz_surge;
  applyHit(atk, p, { dmg: 1e6, sure: true }, {}); out.surgeHp = p.hp === Math.ceil(p.hpMax * 0.5); out.surgeShield = !!(p.buffs.bz_surge && p.buffs.bz_surge.shield);
  const hpS = p.hp; out.surgeBlock = applyHit(atk, p, { dmg: 5, sure: true }, {}) === false && p.hp === hpS; T.run(30);
  // 阿修罗：背击回避（绝对感知）、邪光波动阵定身
  T.job('asura'); T.reset(); p.face = 1; atk.x = p.x - 60; atk.face = 1; fixR(0.01); const hpBk = p.hp; out.backEvade = applyHit(atk, p, { dmg: 5 }, {}) === false && p.hp === hpBk; relR();
  Object.assign(atk, { x: 380, z: 0, vz: 0, invul: 0, status: {} }); atk.hp = 1e9; atk.setState('idle'); T.bar(['as_array']); T.reset(); p.cool = {}; out.arr = T.cast('as_array'); T.run(30); out.root = !!(atk.status && atk.status.root); T.run(120); T.clear();
  return out;
});
report('三段刃 5 段', R.triple.length === 5, R.triple);
report('空之连刃：学了 3 斩、没学 1 斩', R.airOn.length === 3 && R.airOff.length === 1, [R.airOn, R.airOff]);
report('后跳中 Z = 银光落刃', R.backSilver === 'silver', R.backSilver);
report('月光斩追加上斩', R.moon2 === 'moon2', R.moon2);
report('十字刃追加推击 / 可被其他技能取消', R.cross2 === 'cross2' && R.crossCancel === 'upslash', [R.cross2, R.crossCancel]);
report('嗜魂之手：剑魂可用、命中、不回血', R.soulCast === 'soulhand' && R.soulHitMob && R.soulHeal < 5, [R.soulCast, R.soulHitMob, R.soulHeal]);
report('卡赞 BUFF；剑影不能学', R.kazan && R.kazanGhostblade === false, [R.kazan, R.kazanGhostblade]);
report('里·鬼剑术段数：太刀 4 / 巨剑 2 / 短剑 3 / 钝器 4', R.rkKatana === 4 && R.rkGreat === 2 && R.rkShort === 3 && R.rkClub === 4, [R.rkKatana, R.rkGreat, R.rkShort, R.rkClub]);
report('里·鬼剑术按 X 接回普攻', R.rkToBasic === 'atk2', R.rkToBasic);
report('流心 X = 刺、Space = 狂（永久）', R.flowX === 'flow_stab' && R.flowSpace === 'flow_frenzy' && R.flowFrenzyT > 1000, [R.flowX, R.flowSpace, R.flowFrenzyT]);
report('流心 C = 跃，不追加落地回架势，再按流心键解除', R.flowC === 'flow_leap' && R.leapBackToStance && R.flowExit, [R.flowC, R.leapBackToStance, R.flowExit]);
report('三段刃 → 流心', R.tripleToFlow === 'flow', R.tripleToFlow);
report('拔刀斩打到身后', R.iaiBehind, R.iaiBehind);
report('逆转反击：被背击后 Z', R.reverse === 'wm_reverse', R.reverse);
report('光剑掌握：破军升龙击冷却 9 秒', Math.abs(R.riseCd - 9) < 0.05, R.riseCd);
report('狂战士：没开狂暴不能放狂气斩', R.scratchNoFrenzy === null, R.scratchNoFrenzy);
report('狂暴之力：开启、扣血、普攻二刀流', R.frenzyOn && R.frenzyCost > 0 && /^bzA/.test(R.dualClip || ''), [R.frenzyOn, R.frenzyCost, R.dualClip]);
report('狂暴中可放狂气斩；转职技能冷却 −10%', R.scratchFrenzy === 'bz_scratch' && Math.abs(R.outrageCd - 11.7) < 0.05, [R.scratchFrenzy, R.outrageCd]);
report('爆发之刃命中即爆、可取消', R.bladeBoomAt >= 0 && R.bladeBoomAt < 26 && R.bladeCancel === 'outrage', [R.bladeBoomAt, R.bladeCancel]);
report('血气旺盛：十字刃出血（学了血气界限后射出的血十字也出血）', R.crossBleed && R.crossLimit, [R.crossBleed, R.crossLimit]);
report('饥渴：蓄力耗血并获得 BUFF', R.thirstHp >= 25 && R.thirstBuff, [R.thirstHp, R.thirstBuff]);
report('狂暴之力再按解除、普攻回单刀', R.frenzyOff && R.singleClip === undefined || (R.frenzyOff && !/^bzA/.test(R.singleClip || '')), [R.frenzyOff, R.singleClip]);
report('阿修罗：没有波动印不能放鬼印珠', R.orbNoMark === null, R.orbNoMark);
report('波动刻印：开启得 1 印，7 秒后 2 印', R.mark1 === 1 && R.mark2 === 2, [R.mark1, R.mark2]);
report('鬼印珠消耗全部波动印并命中', R.orbCast === 'as_orb' && R.markAfterOrb === 0 && R.orbHit, [R.orbCast, R.markAfterOrb, R.orbHit]);
report('冰刃 → 满蓄邪光斩', R.evilLinked === 'as_evil' && R.evilFull, [R.evilLinked, R.evilFull]);
report('波动爆发：倒地时也能用', R.burstDown === 'as_burst', R.burstDown);
report('无双波需要无尽波动；无尽波动耗 MP、伤害周围', R.musouNoAura === null && R.auraMp > 0 && R.auraHit && R.musouAura === 'as_musou', [R.musouNoAura, R.auraMp, R.auraHit, R.musouAura]);
report('不动明王阵消耗全部波动印并命中', R.fudo === 'as_fudo' && R.markAfterFudo === 0 && R.fudoHit, [R.fudo, R.markAfterFudo, R.fudoHit]);
report('暗天波动眼：需要无尽波动、领域中地裂变光翼、再按结束', R.awkNoAura === null && R.domain && R.wing === 'as_wing' && R.domainEnd, [R.awkNoAura, R.domain, R.wing, R.domainEnd]);
report('阿修罗 →→+Z = 邪光斩', R.ffZ === 'as_evil', R.ffZ);
report('鬼泣：萨亚之阵生成、命中，再放替换旧阵', R.sayaN === 1 && R.sayaHit && R.sayaReplace === 1, [R.sayaN, R.sayaHit, R.sayaReplace]);
report('鬼神解放：鬼影鞭中按罗刹不打断直接放阵；没学时放不出', R.softAct === 'sb_whip' && R.softField === 1 && R.noSoftField === 0, [R.softAct, R.softField, R.noSoftField]);
report('罗刹附身，离开阵也不掉；普戾蒙减益；泯灭仪式清阵', R.rashaOn && R.rashaStay && R.plemon && R.purged === 0, [R.rashaOn, R.rashaStay, R.plemon, R.purged]);
report('凯贾：跑攻 = 冲刺，冲刺中才能接鬼影闪', R.flashNoKaiga === null && R.kaigaDash && R.flashKaiga === 'sb_flash', [R.flashNoKaiga, R.kaigaDash, R.flashKaiga]);
report('卡洛：普攻额外发射分身并附加冥炎；再按切换紫焰；冥炎剑需要卡洛', R.bladeNoKaro === null && R.karoShot && R.karoBurn && R.karoPurple && R.bladeKaro === 'sb_karoblade', [R.bladeNoKaro, R.karoShot, R.karoBurn, R.karoPurple, R.bladeKaro]);
report('鬼泣的卡赞是被动（不能施放）', R.kazanSb === null, R.kazanSb);
report('剑影：鬼人化普攻 4 段', R.gbBasic === 4, R.gbBasic);
report('幻鬼：一闪现身出招、幻鬼步瞬移并无敌、之后消失', R.phantom && R.phantomHit && R.retrace && R.retraceInvul && R.phantomGone, [R.phantom, R.phantomHit, R.retrace, R.retraceInvul, R.phantomGone]);
report('剑术中无动作叠加幻鬼技能', R.stackAct === 'gb_chain' && R.stackPhantom, [R.stackAct, R.stackPhantom]);
report('鬼步 + 剑术 = 瞬移收尾并伤害路径上的敌人', R.stepMoved && R.stepHit && /^gbStep_/.test(R.stepAct || ''), [R.stepMoved, R.stepHit, R.stepAct]);
report('离魂一闪：与已分离的幻鬼交换位置', R.rikoSwap, R.rikoSwap);
report('剑影不能学卡赞', R.gbKazan === false, R.gbKazan);
const p1bad = Object.entries(R.p1).filter(([, v]) => !v).map(([k]) => k);
report('P1：五个转职的觉醒与 48–100 级主动技能都能正常施放', p1bad.length === 0, p1bad.length ? p1bad : Object.keys(R.p1).length);
report('万剑归宗：飞剑、穿云刺、再按御剑术；开天斩与暴风式共享冷却', R.swords === 1 && R.thrust && R.swordsEnd === 0 && R.awkShared, [R.swords, R.thrust, R.swordsEnd, R.awkShared]);
report('魔狱血刹：背后血剑、攻击吸收血气、再按甩下；血剑在背上时三觉代替收尾', R.bloodSword && R.bloodAbsorb && R.bloodSwordFall && R.awk3Finish, [R.bloodSword, R.bloodAbsorb, R.bloodSwordFall, R.awk3Finish]);
report('阿修罗：心眼挡一次；雷神之息附带感电', R.mind && R.mind2 && R.thunderShock, [R.mind, R.mind2, R.thunderShock]);
report('吉格降临处决低 HP 敌人', R.jigExec, R.jigExec);
report('鬼步中的无式·极影剑 = 鬼步形态', /^gbStep_gb_mushiki/.test(R.mushikiStep || ''), R.mushikiStep);
report('自动格挡挡下正面攻击', R.autoGuard, R.autoGuard);
report('格挡：物理吸收 > 魔法吸收', R.guardPhys < R.guardMag && Math.abs(R.guardPhys - 0.44) < 0.06 && Math.abs(R.guardMag - 0.65) < 0.06, [R.guardPhys, R.guardMag]);
report('感电：光剑命中附带、再挨打追加感电伤害', R.shock && R.shockProc, [R.shock, R.shockProc]);
report('狂气涌动：HP 停在 50%、生成血盾后吸收伤害', R.surgeBuff && R.surgeHp && R.surgeShield && R.surgeBlock, [R.surgeBuff, R.surgeHp, R.surgeShield, R.surgeBlock]);
report('阿修罗：背击回避、邪光波动阵定身', R.backEvade && R.root, [R.backEvade, R.root]);
report('狂暴之力没开：提示怎么开（按键）', /需要狂暴之力（.+开启）/.test(R.needMsg || ''), R.needMsg);
report('狂战士：狂暴之力自动放上快捷栏前排', R.gateSlot >= 0 && R.gateSlot < 7, R.gateSlot);
report('狂暴之力开启：BUFF 图标高亮', R.frenzyHl, R.frenzyHl);
// ---- 2026-09-29 补做的遗留项：鬼印珠抵消投射物、剑魂三段刃 7 段、鬼神冠冕后的满月斩 ----
const R2 = await page.evaluate(() => {
  const out = {}, p = game.player; T.clear();
  const seq = (id, n = 120) => { T.cast(id); const names = []; for (let i = 0; i < n; i++) { T.run(1); if (p.act && !names.includes(p.act.name)) names.push(p.act.name); if (p.act && p.actT > 0.16) T.tap('s0'); } return names; };
  // 鬼印珠：飞行中抵消敌方投射物（大判定的激光不抵消）
  T.job('asura'); T.bar(['as_orb']); T.reset(); p.buffs.as_mark = { t: 9999, n: 3, gen: 7 }; p.cool = {};
  const sh = T.mob(1000, 100); T.cast('as_orb'); T.run(16); const orb = projs.find(q => q.owner === p);
  const small = spawnProj({ owner: sh, x: orb.x + 140, y: p.y, z: orb.z + 10, vx: -320, face: -1, life: 3, w: 10, d: 12, h: 20, pierce: false, hit: { dmg: 10, stun: 0.2 } });
  const big = spawnProj({ owner: sh, x: orb.x + 140, y: p.y, z: orb.z + 10, vx: -320, face: -1, life: 3, w: 70, d: 30, h: 60, pierce: true, hit: { dmg: 10, stun: 0.2 } });
  let bigCulled = false; for (let i = 0; i < 30; i++) { T.run(1); if (big.culled) bigCulled = true; }
  out.orbErase = projs.indexOf(small) < 0 && !!small.culled; out.orbKeepsBig = !bigCulled; T.clear(); T.run(200);
  // 剑魂：太刀 / 光剑 + 武器奥义 5 级 → 三段刃 7 段；巨剑还是 5 段
  T.job('blade'); T.bar(['triple']); T.weapon('katana'); T.reset(); out.bladeKatana = seq('triple').filter(n => n.startsWith('triple')).length;
  T.weapon('greatsword'); T.reset(); out.bladeGreat = seq('triple').filter(n => n.startsWith('triple')).length; T.weapon('katana');
  // 鬼泣：学了鬼神冠冕后满月斩 = 造月 → 染黑 → 击碎（0.72 秒，击碎附带失明）；没学时还是 0.5 秒的双手上挑
  T.job('soulbender'); T.bar(['moon']); T.reset(); const mm = T.mob(390, 100); let m3 = null;
  T.cast('moon'); for (let i = 0; i < 150; i++) { T.run(1); if (p.act && p.act.name === 'moon3' && !m3) m3 = p.act.dur; if (p.act && p.actT > 0.16 && p.act.name !== 'moon3') T.tap('s0'); }
  out.crownMoon = m3; out.crownBlind = !!(mm.status && mm.status.blind); T.clear();
  game.skillLv.sb_crown = 0; T.reset(); m3 = null; T.cast('moon'); for (let i = 0; i < 150; i++) { T.run(1); if (p.act && p.act.name === 'moon3' && !m3) m3 = p.act.dur; if (p.act && p.actT > 0.16 && p.act.name !== 'moon3') T.tap('s0'); }
  out.plainMoon = m3; game.skillLv.sb_crown = SKILLS.sb_crown.maxLv || 1;
  return out;
});
report('鬼印珠：飞行中抵消敌方投射物，激光类大判定不抵消', R2.orbErase && R2.orbKeepsBig, [R2.orbErase, R2.orbKeepsBig]);
report('剑魂三段刃：太刀 7 段、巨剑 5 段', R2.bladeKatana === 7 && R2.bladeGreat === 5, [R2.bladeKatana, R2.bladeGreat]);
report('满月斩：鬼神冠冕后变成造月 → 染黑 → 击碎（附带失明），没学时是普通上挑', R2.crownMoon === 0.72 && R2.crownBlind && R2.plainMoon === 0.5, [R2.crownMoon, R2.crownBlind, R2.plainMoon]);

// ---- 疾影手 / 神影手：一键在身上的武器和背包备用武器之间切换 ----
const R3 = await page.evaluate(() => {
  const out = {}, p = game.player; T.clear(); inv.ensure(); T.job('blade'); game.lvl = Math.max(game.lvl, 30);
  inv.equip.weapon = makeItem('katana_1_0', 1, { grade: 2 }); const club = makeItem('club_1_0', 1, { grade: 2 }), kat2 = makeItem('katana_1_0', 1, { grade: 2 });
  inv.items = inv.items.filter(x => !(x.kind === 'equip' && x.slot === 'weapon')); inv.items.push(club, kat2); inv._alt = null;
  game.skillLv.wm_swap = 1; game.skillLv.wm_swap2 = 0; T.reset(); T.mob(420, 100);
  T.tap('wswap'); T.run(2); out.w1 = inv.equip.weapon && inv.equip.weapon.wtype; out.buff = p.buffs.wm_swapbuff ? [p.buffs.wm_swapbuff.aspd, p.buffs.wm_swapbuff.t] : null; out.cd = p.cool.wm_swap;
  T.tap('wswap'); T.run(2); out.coolBlocks = inv.equip.weapon.wtype === 'club';
  p.cool.wm_swap = 0; T.tap('wswap'); T.run(2); out.back = inv.equip.weapon.wtype; out.altKept = inv.items.some(x => x.wtype === 'club');
  game.skillLv.wm_swap2 = 1; p.buffs = {}; p.cool.wm_swap = 0; T.tap('wswap'); T.run(2); out.deft = p.buffs.wm_swapbuff ? [p.buffs.wm_swapbuff.aspd, p.buffs.wm_swapbuff.t] : null; out.w3 = inv.equip.weapon.wtype;
  T.clear(); return out;
});
report('疾影手：切到不同类武器 +7.5% 攻速 / 移速 10 秒、冷却 5 秒；冷却中不能再切；再切回换回原武器', R3.w1 === 'club' && R3.buff && R3.buff[0] === 0.075 && Math.abs(R3.buff[1] - 10) < 0.2 && R3.cd > 4 && R3.coolBlocks && R3.back === 'katana' && R3.altKept, R3);
report('神影手：切到不同类武器 +15% 攻速 / 移速 15 秒', R3.deft && R3.deft[0] === 0.15 && Math.abs(R3.deft[1] - 15) < 0.2 && R3.w3 === 'club', R3.deft);
const errs = logs.filter(l => l.type !== 'warning'); if (errs.length) fail++;
console.log('LOGS', JSON.stringify(errs.slice(0, 6), null, 1));
await browser.close();
process.exit(fail ? 1 : 0);
