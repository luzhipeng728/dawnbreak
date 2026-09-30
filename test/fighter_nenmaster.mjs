// 格斗家转职测试：气功师（nenmaster，B4）。node test/fighter_nenmaster.mjs（约 30 秒）
// 查：转职登记（布甲 / 魔法）、29 个技能 id 都在 FIGHTER_IDS.nenmaster 里且都有定义、指令 / 图标文字 / 动画表齐全；
//     23 个主动技能逐个对着木桩（逐帧 step，确定性；全部技能 5 级 = 学了禅意·万象：蓄念炮必满蓄、念气环绕：袭 直接爆炸）：放得出来、MP 消耗 = 定义、冷却 = 定义 × 刷图冷却系数、
//     命中次数下限、所有命中都是魔法伤害、该感电的感电 / 该眩晕的眩晕 / BUFF 类挂上 BUFF、不报错。
// 机制测试（念气珠 / 龙虎啸 / 风雷能量 / 念气罩 / 金雷虎 / 觉醒 / 连拍截图）在 test/nenmaster.mjs
import { launch, URL_BASE } from './lib.mjs';
const JOB = 'nenmaster';
let fail = 0;
const report = (name, ok, info) => { if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${JSON.stringify(info)}`); };
const { browser, page, logs } = await launch({ width: 960, height: 540 });
await page.goto(`${URL_BASE}?test&cls=fighter&fighter=1&mobs=0&mute`); await page.waitForFunction(() => window.__READY, null, { timeout: 30000 });
// 每个主动技能的期望：hits = 对单个木桩（身前 80px）的最少命中次数，st = 木桩身上应该出现过的异常，buff = 自己身上的 BUFF，zone = 放出的召唤 / 区域
const EXPECT = {
  fn_tattoo: { buff: 'fn_tattoo' }, fn_cannon: { hits: 1 }, fn_spiral: { buff: 'fn_spiral' }, fn_legstrike: { hits: 2, st: 'shock' }, fn_blast: { hits: 1 }, fn_guard: { zone: 'fn_guardzone' },
  fn_press: { hits: 3 }, fn_nencannon2: { hits: 4, st: 'shock' }, fn_stone: { buff: 'fn_stone' }, fn_tiger: { buff: 'fn_tiger' }, fn_roar: { hits: 1, st: 'stun' },
  fn_thunderdrop: { hits: 6, st: 'shock' }, fn_field: { hits: 12, st: 'shock' }, fn_haitai: { hits: 4 }, fn_awaken: { hits: 6 }, fn_spear: { hits: 2, st: 'hold' }, fn_pillar: { hits: 6, st: 'shock' },
  fn_windstorm: { buff: 'fn_windstorm' }, fn_blade: { hits: 1, st: 'hold' }, fn_moon: { hits: 10 }, fn_awaken2: { hits: 6 }, fn_tigerblast: { hits: 11 }, fn_awaken3: { hits: 7 },
};
const R = await page.evaluate(({ JOB, EXPECT }) => {
  game.paused = true; window.toastMsg = () => {};
  const p = game.player, J = CLASSES.fighter.jobs[JOB], run = n => { for (let i = 0; i < n; i++) step(1 / 60); };
  game.job = JOB; Object.assign((save.data.flags ??= {}), { awaken: true, awaken2: true, awaken3: true });
  if (typeof onJobChange === 'function') onJobChange(p, JOB);
  for (const id of classSkills('fighter', JOB)) game.skillLv[id] = Math.max(1, Math.min(SKILLS[id] ? SKILLS[id].maxLv || 5 : 1, 5));
  cmdLabel('fighter');
  const stray = J.skills.filter(id => !FIGHTER_IDS[JOB].includes(id)), undef = J.skills.filter(id => !SKILLS[id]), missing = FIGHTER_IDS[JOB].filter(id => !J.skills.includes(id));
  const noCmd = J.skills.filter(id => SKILLS[id] && !SKILLS[id].passive && !SKILLS[id].cmdTxt);
  const noDesc = J.skills.filter(id => SKILLS[id] && !(SKILLS[id].desc && SKILLS[id].desc.length > 20));
  const badClip = [];
  const log = [], st = [], o1 = window.applyHit, o2 = window.addStatus;
  window.applyHit = function (a, t, h, o) { const r = o1.apply(this, arguments); if (r && t && t.__dummy) log.push(h.type || (o && o.type) || (a.act && a.act.type) || a.dmgType); return r; };
  window.addStatus = function (t, kind) { if (t && t.__dummy) st.push(kind); return o2.apply(this, arguments); };
  const R0 = game.room, per = {};
  for (const id of J.skills.filter(id => !SKILLS[id].passive)) {
    for (const e of ents) if (e.team === 'e') e.remove = true; run(1); clearAllSummons(); projs.length = 0;
    Object.assign(p, { x: R0 ? (R0.x0 + R0.x1) / 2 - 120 : 300, y: 100, z: 0, vz: 0, vx: 0, vy: 0, cool: {}, mp: 5000, mpMax: 1e6, face: 1, invul: 0, hp: p.hpMax, _fnE: 600 }); p.buffs = {}; p.act = null; p.setState('idle');
    const m = spawnMonster('goblin', p.x + 80, p.y); m.control = null; m.hp = m.hpMax = 1e9; m.invul = 0; m.__dummy = true;
    log.length = 0; st.length = 0;
    const S = SKILLS[id], mp0 = p.mp, ok = castSkill(p, id), mpUsed = Math.round(mp0 - p.mp), cd = p.cool[id] || 0;
    const actOk = !!p.act || typeof S.instant === 'function', clip = p.act && p.act.clip;
    if (clip && !CLIPS.fighter[clip]) badClip.push(id + ':' + clip);
    let zone = 0; for (let i = 0; i < 7 * 60; i++) { step(1 / 60); if (EXPECT[id] && EXPECT[id].zone) zone = Math.max(zone, summonsOf(p, EXPECT[id].zone).length); }
    const E = EXPECT[id] || {}, buff = E.buff ? !!p.buffs[E.buff] : null;
    const cdWant = S.cd * (p.cdMul || 1);
    per[id] = { ok, actOk, mp: [mpUsed, S.mp], cd: [+cd.toFixed(2), +cdWant.toFixed(2)], hits: log.length, mag: log.every(t => t === 'mag'), st: [...new Set(st)], buff, zone };
  }
  window.applyHit = o1; window.addStatus = o2;
  return { reg: !!J, ready: J.ready, armor: J.armor, dmg: J.dmgType || 'phys', n: J.skills.length, stray, undef, missing, noCmd, noDesc, badClip, per,
    anims: Object.keys(J.anims || {}).filter(k => !SPR_ANIMS.fighter[k]), auto: J.auto };
}, { JOB, EXPECT });
report('转职登记（精通 cloth、伤害 mag、已开放）', R.reg && R.armor === 'cloth' && R.dmg === 'mag' && R.ready === true, { ready: R.ready, armor: R.armor, dmg: R.dmg });
report(`技能 id = 预留表 FIGHTER_IDS.${JOB}（${R.n} 个，都有定义）`, !R.stray.length && !R.undef.length && !R.missing.length && R.n === 29, { stray: R.stray, undef: R.undef, missing: R.missing });
report('主动技能都有指令文字、技能说明；动画片段都登记进 SPR_ANIMS.fighter；转职自动学会念气感知 / 光之亲和', !R.noCmd.length && !R.noDesc.length && !R.anims.length && !R.badClip.length && R.auto.join() === 'fn_sense,fn_lightaff',
  { noCmd: R.noCmd, noDesc: R.noDesc, anims: R.anims, badClip: R.badClip });
for (const [id, v] of Object.entries(R.per)) {
  const E = EXPECT[id] || {}, probs = [];
  if (!v.ok || !v.actOk) probs.push('放不出');
  if (v.mp[0] !== v.mp[1]) probs.push('MP');
  if (Math.abs(v.cd[0] - v.cd[1]) > 0.02) probs.push('冷却');
  if (E.hits && v.hits < E.hits) probs.push('命中');
  if (!v.mag) probs.push('不是魔法');
  if (E.st && !v.st.includes(E.st)) probs.push('没有' + E.st);
  if (E.buff && !v.buff) probs.push('没有 BUFF');
  if (E.zone && !v.zone) probs.push('没有罩');
  report(`${id}`, !probs.length, { probs, ...v });
}
const errs = logs.filter(l => l.type === 'pageerror' || l.type === 'error'); report('无报错', errs.length === 0, errs.slice(0, 3));
await browser.close();
console.log(fail ? `${fail} 项失败` : '全部通过');
process.exit(fail ? 1 : 0);
