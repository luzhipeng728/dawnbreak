// 小魔女（魔法师转职 enchantress）：暂停游戏循环、手动逐帧推进验证。node test/enchantress.mjs
// 疯疯熊自动出现 / 站在身前 / 打不到；每个主动技能都能放出来且不报错、攻击技能打得到人；
// 单刷模式 vs 组队模式（用假的 coop 队友影子）：攻击力 +40%、冷却 −20%、偏爱对象（熊 / 队友）、禁忌诅咒给队友的加成与副作用、队友重放时 BUFF 落在本机玩家身上；
// 一觉人偶剧场（变身操控熊、谢幕全屏伤害、复原、剧场中 BUFF 不做动作、再按谢幕）、二觉（剧场中施放剧场不结束）、三觉（短篇舞台叠加）、林中小屋（跳进去无敌、跳出来）、
// 疯熊守护受击中可放、不祥的微笑、人偶戏法连按 X、蔷薇囚狱再按引爆、变大吧跳跃中断
import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';
let fail = 0;
const report = (name, ok, info) => { if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${JSON.stringify(info)}`); };
const out = 'test/shots/enchantress'; fs.mkdirSync(out, { recursive: true });
const { browser, page, logs } = await launch({ width: 960, height: 540 });
await page.goto(`${URL_BASE}?rawcd&test&cls=mage&mobs=0&mute`); await page.waitForFunction(() => window.__READY, null, { timeout: 30000 });
const R = await page.evaluate(() => {
  game.paused = true;
  const run = n => { for (let i = 0; i < n; i++) { input.frame(game.t); if (game.player.pad !== input) game.player.pad.frame(game.t); step(1 / 60); } };
  const press = (key, n) => { const P = game.player.pad = new Pad(); P.tap(key); run(n); game.player.pad = input; };
  const mob = (x = 420, y = 100, o = {}) => { const m = spawnMonster('goblin', x, y); m.control = null; m.invul = 0; m.hp = m.hpMax = 1e9; m.evade = 0; m.def = 0; m.mdef = 0; Object.assign(m, o); return m; };
  const clearMobs = () => { for (const e of ents) if (e.team === 'e') e.remove = true; run(1); projs.length = 0; };
  const p = game.player, out = {};
  try {
  game.job = 'enchantress'; save.data.job = 'enchantress'; Object.assign(save.data.flags ??= {}, { awaken: true, awaken2: true, awaken3: true });
  for (const id of CLASSES.mage.jobs.enchantress.skills) game.skillLv[id] = SKILLS[id].awaken ? 1 : 5;
  for (const id of CLASSES.mage.skills) game.skillLv[id] = Math.max(game.skillLv[id] || 0, 1);
  onJobChange(p, 'enchantress');
  Object.assign(p, { x: 300, y: 100, face: 1, crit: 0, mcrit: 0, dmgUp: 0, hitRate: 1 }); p.baseCrit = 0; p.mpMax = p.mp = 1e6;
  const fresh = () => { p.hp = p.hpMax; p.mp = p.mpMax; p.cool = {}; p.charges = {}; p.invul = 0; p.stun = 0; if (p.act) p.endAct(); p.setState('idle'); p.x = 300; p.y = 100; p.z = 0; p.vx = p.vy = p.vz = 0; p.face = 1; };
  const cast = id => { fresh(); const ok = castSkill(p, id, false, null); return { ok, act: p.act && p.act.skill }; };
  // ---- 1. 疯疯熊：自动出现、站在身前、打不到、单只 ----
  run(30);
  const bear = summonsOf(p, 'en_bear')[0];
  out.bear = { n: summonsOf(p, 'en_bear').length, front: bear ? Math.round((bear.x - p.x) * p.face) : null, invul: bear && bear.invul === Infinity, type: bear && bear.dmgType };
  // ---- 2. 每个主动技能都能放、不报错；攻击技能打得到 ----
  const ids = CLASSES.mage.jobs.enchantress.skills.filter(id => !SKILLS[id].passive && id !== 'en_possession');
  const res = {};
  for (const id of ids) {
    clearMobs(); dismissSummons(p, { tag: '*' }); summonsOf(p, 'en_bear').forEach(s => dismissOne(s, 'test')); run(2);
    const m = mob(430, 100); const hp0 = m.hp; const c = cast(id);
    run(Math.round(60 * (SKILLS[id].awaken ? (id === 'en_awaken' ? 40 : id === 'en_awaken3' ? 56 : 8) : 5)));
    res[id] = { ok: c.ok, act: c.act === id, dmg: hp0 - m.hp > 0 };
    if (p.enStage) enStageEnd(p, false);
  }
  out.cast = res;
  clearMobs(); fresh(); run(5);
  // ---- 3. 单刷模式 ----
  p.buffs = {}; const solo0 = enSolo(); run(20);
  const dmgOf = id => { clearMobs(); const m = mob(400, 100); fresh(); run(1); p.face = 1; const hp0 = m.hp; castSkill(p, id, false, null); run(90); return hp0 - m.hp; };
  const avg = (fn, n = 6) => { let s = 0; for (let i = 0; i < n; i++) s += fn(); return s / n; };
  const soloBuff = p.buffs.en_solo ? p.buffs.en_solo.atk : 0;
  const aSolo = atkOf(p, 'indep'); const dSolo = avg(() => dmgOf('en_rosewhip'), 10);
  fresh(); castSkill(p, 'en_rosewhip', false, null); const cd0 = p.cool.en_rosewhip; run(180); const soloCd = +((cd0 - p.cool.en_rosewhip) / 3).toFixed(2);
  fresh(); castSkill(p, 'en_favor', false, null); run(60); const favSolo = { bear: !!(p.buffs.en_favor && p.buffs.en_favor.bear), bearDmg: !!(summonsOf(p, 'en_bear')[0] && summonsOf(p, 'en_bear')[0].buffs.en_favor) };
  fresh(); castSkill(p, 'en_forbidden', false, null); run(80); const forbSolo = { ...p.buffs.en_forbidden };
  out.solo = { solo: solo0, atk: soloBuff, cdPerSec: soloCd, fav: favSolo, forbSelfAtk: +(forbSolo.atk || 0).toFixed(3), forbSelfDmg: +(forbSolo.dmg || 0).toFixed(3) };
  // ---- 4. 组队模式（假的 coop：一个队友影子）----
  const g = makePlayer('sword', { team: 'p', kit: { bar: [], lv: {}, job: 'blade', wtype: null }, name: '队友', pad: new Pad() });
  g.ghost = true; g.uid = 99; g.control = null; g.x = 360; g.y = 110; ents.push(g);
  coop.role = 'host'; coop.state = 'play'; coop.mates.set(99, g);
  p.buffs = {}; run(20);
  const party0 = !enSolo();
  const aParty = atkOf(p, 'indep'); const dParty = avg(() => dmgOf('en_rosewhip'), 10);
  fresh(); castSkill(p, 'en_rosewhip', false, null); const cd1 = p.cool.en_rosewhip; run(180); const partyCd = +((cd1 - p.cool.en_rosewhip) / 3).toFixed(2);
  g.x = p.x + 60; g.buffs = {}; fresh(); g.x = p.x + 60; castSkill(p, 'en_favor', false, null); run(60);
  const favParty = { bear: !!(p.buffs.en_favor && p.buffs.en_favor.bear), mateFavored: !!g.buffs.en_favored, mateFavor: !!g.buffs.en_favor };
  fresh(); castSkill(p, 'en_forbidden', false, null); run(80);
  out.party = { party: party0, soloBuff: !!p.buffs.en_solo, cdPerSec: partyCd, fav: favParty, selfAtk: +(p.buffs.en_forbidden && p.buffs.en_forbidden.atk || 0).toFixed(3), mateAtk: +(g.buffs.en_forbidden && g.buffs.en_forbidden.atk || 0).toFixed(3) };
  out.ratio = { atk: +(aSolo / aParty).toFixed(3), dmg: +(dSolo / dParty).toFixed(2) };
  // 队友那边：小魔女是影子，重放禁忌诅咒 → BUFF 落在本机玩家身上；剩 20 秒起每 5 秒扣 5% HP
  const e2 = makePlayer('mage', { team: 'p', kit: { bar: [], lv: { en_forbidden: 3 }, job: 'enchantress', wtype: null }, name: '小魔女队友', pad: new Pad() });
  e2.ghost = true; e2.uid = 98; e2.control = null; e2.x = p.x + 100; e2.y = p.y; ents.push(e2); coop.mates.set(98, e2);
  delete p.buffs.en_forbidden; delete p.buffs.en_favored;
  e2.doAct(SKILLS.en_forbidden.act(3, e2), { skill: 'en_forbidden', lv: 3 }); run(80);
  const rb = p.buffs.en_forbidden; out.replay = { got: !!rb, self: rb && !!rb.self, atk: rb && +(rb.atk || 0).toFixed(3) };
  if (rb) { rb.t = 19; p.hp = p.hpMax; const h0 = p.hp; run(60 * 5.2); out.replay.drain = +((h0 - p.hp) / p.hpMax).toFixed(3); }
  e2.remove = true; coop.mates.delete(98); g.remove = true; coop.mates.clear(); coop.state = 'none'; coop.role = null; run(2);
  out.soloBack = enSolo();
  // ---- 5. 一觉：人偶剧场 ----
  clearMobs(); fresh(); dismissSummons(p); run(10);
  const m5 = mob(460, 100); const hp5 = m5.hp; const model0 = p.model;
  castSkill(p, 'en_awaken', false, null); run(60 * 3.4);
  const st = p.enStage, b5 = summonsOf(p, 'en_bear')[0];
  out.stage = { on: !!st, acts: p.acts === EN_STAGE_ACTS, modelSwapped: p.model !== model0, bearHidden: b5 && b5.model === EN_EMPTY_MODEL, immune: !!(p.statusImmune && p.statusImmune.stun), dolls: summonsOf(p, 'en_doll').length > 0 || true };
  fresh(); press('attack', 8); out.stage.bearAtk = !!(p.act && /^bScratch/.test(p.act.clip || '')); run(40);
  fresh(); castSkill(p, 'en_scratch', false, null); out.stage.bearSkillOnSelf = !!(p.act && p.act.clip === 'bScratch');
  run(60);
  castSkill(p, 'mg_orb', false, null); out.stage.blockBase = !(p.act && p.act.skill === 'mg_orb');
  const hpMid = m5.hp; st.t = st.dur - 0.05; run(60);
  out.stage.finale = hpMid - m5.hp > 0; out.stage.restored = !p.enStage && p.model === model0 && p.acts === MAGE_ACTS && !!summonsOf(p, 'en_bear')[0] && summonsOf(p, 'en_bear')[0].model !== EN_EMPTY_MODEL;
  // 三觉短篇舞台：剧场中施放 → 延长 20 秒
  fresh(); p.cool = {}; castSkill(p, 'en_awaken', false, null); run(60 * 3.4); const d0 = p.enStage && p.enStage.dur; castSkill(p, 'en_awaken3', false, null); run(60 * 3.6);
  out.short = { d0, d1: p.enStage && p.enStage.dur, extended: !!(p.enStage && p.enStage.dur >= d0 + 19) }; if (p.enStage) enStageEnd(p, false);
  // ---- 6. 林中小屋：跳上去进屋、无敌、跳出来 ----
  clearMobs(); fresh(); p._enHutN = 0; castSkill(p, 'en_hut', false, null); run(60 * 1.2);
  const hut = SUMMONS.find(s => s.skey === 'en_hut' && !s.gone);
  p.x = hut.x; p.y = hut.y; p.z = 30; p.vz = -50; p.setState('jump'); run(3);
  const inHut = { entered: p.enHut === hut, invul: p.invul > 0 };
  press('jump', 3); inHut.left = !p.enHut && p.model !== EN_EMPTY_MODEL;
  p._enHutN = 2; fresh(); inHut.limit = castSkill(p, 'en_hut', false, null) && !(p.act && p.act.skill === 'en_hut');
  out.hut = inHut; p._enHutN = 0;
  // ---- 7. 疯熊守护：受击中也能放；不祥的微笑：藤鞭落空冷却 1 秒 ----
  clearMobs(); fresh(); mob(420, 100); p.setState('hit'); p.stun = 1;
  out.guardHit = { ok: castSkill(p, 'en_guard', false, null), stillHit: p.st === 'hit' };
  clearMobs(); fresh(); castSkill(p, 'en_rosewhip', false, null); run(60); out.sinister = +(p.cool.en_rosewhip || 0).toFixed(2);
  const f0 = { ...save.data.flags }; save.data.flags.awaken2 = false; fresh(); out.tierLock = !castSkill(p, 'en_roarbear', false, null) || !(p.act && p.act.skill === 'en_roarbear'); Object.assign(save.data.flags, f0);
  // ---- 8. 官方行为：剧场中小魔女技能可用（BUFF 不做动作）、再按觉醒键谢幕、人偶之森期间剧场不结束、人偶戏法连按 X 更快、囚狱再按引爆、变大吧跳跃中断 ----
  const B = {}; clearMobs(); fresh(); dismissSummons(p); run(5); const m8 = mob(420, 100);
  castSkill(p, 'en_awaken', false, null); run(60 * 3.4);
  fresh(); delete p.buffs.en_forbidden; castSkill(p, 'en_forbidden', false, null); B.forbQuick = !!p.buffs.en_forbidden && !!p.act && p.act.dur < 0.3; run(20);
  fresh(); B.jailInStage = castSkill(p, 'en_rosejail', false, null) && !!(p.act && p.act.skill === 'en_rosejail'); run(40);
  fresh(); run(60); const hp8 = m8.hp; castSkill(p, 'en_awaken', false, null); run(60); B.recastFinale = !p.enStage && hp8 - m8.hp > 0;
  fresh(); castSkill(p, 'en_awaken', false, null); run(60 * 3.4); castSkill(p, 'en_awaken2', false, null); if (p.enStage) p.enStage.t = p.enStage.dur - 0.2; run(60 * 2);
  B.forestKeeps = !!p.enStage; run(60 * 7); B.forestThenEnd = !p.enStage; if (p.enStage) enStageEnd(p, false);
  const trick = mash => { fresh(); castSkill(p, 'en_puppettrick', false, null); let n = 0; while (p.act && p.act.skill === 'en_puppettrick' && n < 60 * 9) { if (mash) { press('attack', 4); n += 4; } else { run(4); n += 4; } } return +(n / 60).toFixed(2); };
  B.trickT = trick(false); B.trickMashT = trick(true);
  fresh(); castSkill(p, 'en_rosejail', false, null); run(30); castSkill(p, 'en_rosejail', false, null); run(6); B.jailBoom = !summonsOf(p, 'en_jail').length;
  fresh(); castSkill(p, 'en_bigbear', false, null); run(30); press('jump', 3); const bb = summonsOf(p, 'en_bear')[0]; B.bigCancel = !(p.act && p.act.skill === 'en_bigbear') && !(bb && bb.act && bb.act.bigMadd); run(30);
  out.behav = B;
  out.reg = { job: !!CLASSES.mage.jobs.enchantress, armor: masteryOf('mage', 'enchantress'), quest: !!QUESTS.q_job_ench_house, anims: !!SPR_ANIMS.mage.enCmd, noShowtime: !skillAllowed('mg_showtime', 'enchantress') };
  } catch (e) { out.err = e.message + ' ' + (e.stack || '').split('\n').slice(0, 3).join(' | '); }
  return out;
});
if (R.err) { console.log('FAIL  测试脚本出错', R.err, JSON.stringify(R).slice(0, 3000)); process.exit(1); }
const ok = (v, name, info) => report(name, !!v, info ?? v);
ok(R.bear.n === 1 && R.bear.front > 20 && R.bear.invul && R.bear.type === 'indep', '疯疯熊：自动出现、站在身前、打不到、独立攻击', R.bear);
const bad = Object.entries(R.cast).filter(([id, r]) => !r.ok || !r.act);
ok(!bad.length, '每个主动技能都能施放', bad.length ? Object.fromEntries(bad) : Object.keys(R.cast).length + ' 个');
const HEAL = new Set(['en_mend', 'en_favor', 'en_forbidden', 'en_firstaid', 'en_hut']);
const noDmg = Object.entries(R.cast).filter(([id, r]) => !HEAL.has(id) && !r.dmg).map(([id]) => id);
ok(!noDmg.length, '攻击技能都打得到', noDmg.length ? noDmg : 'ok');
ok(R.solo.solo && R.solo.atk === 0.4 && R.solo.cdPerSec > 1.22, '单刷模式：攻击力 +40%、冷却每秒多走 0.25 秒（−20%）', R.solo);
ok(R.solo.fav.bear && R.solo.fav.bearDmg, '单刷模式：偏爱自动选疯疯熊，熊加伤', R.solo.fav);
ok(R.solo.forbSelfAtk > 0 && R.solo.forbSelfDmg > 0, '单刷模式：禁忌诅咒自己也拿攻击力', R.solo);
ok(R.party.party && !R.party.soloBuff && Math.abs(R.party.cdPerSec - 1) < 0.05, '组队模式：没有单刷加成、冷却正常', R.party);
ok(!R.party.fav.bear && R.party.fav.mateFavored && R.party.fav.mateFavor, '组队模式：偏爱身边的队友、全队拿到偏爱 BUFF', R.party.fav);
ok(R.party.selfAtk === 0 && R.party.mateAtk > 0.1, '组队模式：禁忌诅咒给队友攻击力（偏爱对象加成），自己只拿技能攻击力', R.party);
ok(R.ratio.atk > 1.3 && R.ratio.atk < 1.45 && R.ratio.dmg > 1.15 && R.ratio.dmg < 1.6, '单刷 / 组队：攻击力 ×(1.4 + 被动)，实测伤害比', R.ratio);
ok(R.replay.got && !R.replay.self && R.replay.atk > 0 && R.replay.drain >= 0.04, '队友重放禁忌诅咒：BUFF 落在本机玩家身上，剩 20 秒起扣血', R.replay);
ok(R.soloBack, '离开队伍回到单刷模式', R.soloBack);
ok(R.stage.on && R.stage.acts && R.stage.modelSwapped && R.stage.bearHidden && R.stage.immune, '一觉：进入人偶剧场（操控熊、熊隐藏、免疫异常）', R.stage);
ok(R.stage.bearAtk && R.stage.bearSkillOnSelf && R.stage.blockBase, '一觉：普攻 / 熊系技能由主角变成的熊出招，基础技能不能用', R.stage);
ok(R.stage.finale && R.stage.restored, '一觉：谢幕全屏伤害，结束后复原', R.stage);
ok(R.short.extended, '三觉：剧场中施放 = 短篇舞台（延长 20 秒）', R.short);
ok(R.hut.entered && R.hut.invul && R.hut.left && R.hut.limit, '林中小屋：跳进去无敌、跳出来、每张图最多 2 次', R.hut);
ok(R.guardHit.ok && R.guardHit.stillHit, '疯熊守护：受击中也能放（主角不脱离受击）', R.guardHit);
ok(R.sinister <= 1, '不祥的微笑：藤鞭落空冷却 1 秒', R.sinister);
ok(R.tierLock, '二觉段技能要先完成二次觉醒任务', R.tierLock);
const Bh = R.behav;
ok(Bh.forbQuick && Bh.jailInStage, '一觉剧场中：小魔女技能能用，BUFF 不做动作直接生效', Bh);
ok(Bh.recastFinale, '一觉：再按觉醒键提前谢幕（全屏伤害）', Bh);
ok(Bh.forestKeeps && Bh.forestThenEnd, '二觉：人偶之森期间剧场不结束，放完再谢幕', Bh);
ok(Bh.trickT >= 3.8 && Bh.trickMashT < Bh.trickT - 1, '人偶戏法：约 4.5 秒钉完，连按 X 钉得更快', { t: Bh.trickT, mash: Bh.trickMashT });
ok(Bh.jailBoom, '蔷薇囚狱：再按技能键立即引爆', Bh.jailBoom);
ok(Bh.bigCancel, '变大吧！疯疯熊：按跳跃键中断', Bh.bigCancel);
ok(R.reg.job && R.reg.armor === 'plate' && R.reg.quest && R.reg.anims && R.reg.noShowtime, '转职登记：职业窗口、板甲、转职剧情任务、动作表、魔法秀学不了', R.reg);
// 截图：疯疯熊站在小魔女身前（游戏比例）
await page.evaluate(() => { game.paused = false; clearAllSummons('test'); for (const e of ents) if (e.team === 'e') e.remove = true; const p = game.player; p.x = 380; p.y = 110; p.face = 1; p.setState('idle'); });
await page.waitForTimeout(900);
await page.screenshot({ path: `${out}/bear.png` });
const errs = logs.filter(l => l.type === 'pageerror' || (l.type === 'error' && !/favicon|net::|Failed to load resource/.test(l.text)));
ok(!errs.length, '没有页面错误', errs.slice(0, 5));
await browser.close();
console.log(fail ? `✗ ${fail} 项失败` : '全部通过');
process.exit(fail ? 1 : 0);
