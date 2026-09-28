// 鬼剑士（男）官方对齐测试（docs/SKILLS_OFFICIAL_sword.md）：暂停游戏循环、逐帧推进，逐条验证
// 基础：三段刃 5 段、空之连刃空中连斩、后跳中银光落刃、月光斩追加、十字刃追加 / 可被取消、嗜魂之手通用且不回血、卡赞（剑影不能学）
// 剑魂：里·鬼剑术按武器段数、接回普攻、流心 X / Space / C 派生与落地回架势、三段刃 → 流心、拔刀斩打身后、逆转反击（被背击时 Z）、光剑冷却
// 狂战士：狂暴之力开关 + 二刀流 + 扣血、狂暴前置、爆发之刃命中即爆可取消、血气旺盛出血、狂暴冷却、饥渴蓄力耗血。node test/sword.mjs
import { launch, URL_BASE } from './lib.mjs';
let fail = 0;
const report = (name, ok, info) => { if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${JSON.stringify(info)}`); };
const { browser, page, logs } = await launch({ width: 960, height: 540 });
await page.goto(`${URL_BASE}?test&cls=sword&mobs=0&mute`); await page.waitForFunction(() => window.__READY, null, { timeout: 30000 });
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
  T.reset(); const hpA = p.hp; T.cast('frenzy'); T.run(40); out.frenzyOn = !!p.buffs.frenzy; out.frenzyCost = hpA - p.hp; T.run(20);
  T.tap('attack'); T.run(2); out.dualClip = p.act && p.act.clip; T.run(40);
  out.scratchFrenzy = T.cast('bz_scratch'); T.run(40);
  T.cast('outrage'); out.outrageCd = +(p.cool.outrage || 0).toFixed(2); T.run(60);
  // 爆发之刃：命中立即爆炸，命中后可以取消接怒气爆发
  T.clear(); const m2 = T.mob(400, 100); p.cool = {}; T.cast('bloodblade'); let boomAt = -1; for (let i = 0; i < 40; i++) { T.run(1); if (p.act && p.act.boom && boomAt < 0) boomAt = i; } T.tap('s3'); T.run(2); out.bladeBoomAt = boomAt; out.bladeCancel = p.act && p.act.skill; T.run(60);
  // 血气旺盛：十字刃附带出血
  T.clear(); const m3 = T.mob(360, 100); p.cool = {}; T.cast('cross'); T.run(40); out.crossBleed = !!(m3.status && m3.status.bleed); T.clear();
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
report('血气旺盛：十字刃出血', R.crossBleed, R.crossBleed);
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
const errs = logs.filter(l => l.type !== 'warning'); if (errs.length) fail++;
console.log('LOGS', JSON.stringify(errs.slice(0, 6), null, 1));
await browser.close();
process.exit(fail ? 1 : 0);
