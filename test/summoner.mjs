// 召唤师（魔法师对齐组第 3 阶段）：逐个施放召唤技能，检查召唤兽出场、用正式美术、会出手、交感 / 全体指令 / 献祭 / 印记能用、换房间跟随、决斗场 AI 能放。
// node test/summoner.mjs
import { launch, URL_BASE } from './lib.mjs';
let fail = 0;
const report = (name, ok, info) => { if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${JSON.stringify(info)}`); };
const { browser, page, logs } = await launch({ width: 960, height: 540 });
await page.goto(`${URL_BASE}?test&cls=mage&mobs=0&mute`); await page.waitForFunction(() => window.__READY, null, { timeout: 30000 });
// 先把召唤兽的美术分包加载好（正式环境由召唤师进城 / 进地下城时预加载）
await page.evaluate(async () => { game.job = 'summoner'; const B = ['sandor', 'ador', 'naias', 'stalker', 'wisp', 'frit', 'aukuso', 'luise', 'merkle', 'glarelin', 'aqueris', 'flamehulk', 'echeverria', 'goblinCaptain', 'tauKing', 'casillas', 'hilun', 'lamos'];
  if (typeof loadBundles === 'function') await loadBundles(B.filter(b => !IMG[`spr/${b}/idle`]).map(b => 'spr:' + b)); });
const R = await page.evaluate(() => {
  game.paused = true;
  const run = n => { for (let i = 0; i < n; i++) { input.frame(game.t); step(1 / 60); } };
  const p = game.player, out = {};
  for (const id of classSkills('mage', 'summoner')) game.skillLv[id] = Math.min(SKILLS[id].maxLv || 10, 6);
  p.mpMax = p.mp = 1e6; p.x = 300; p.y = 100; p.face = 1;
  const dummy = () => { const m = spawnMonster('goblin', 520, 100); m.control = null; m.hp = m.hpMax = 1e9; m.invul = 0; m.evade = 0; return m; };
  const cast = id => { p.setState('idle'); p.act = null; p.cool = {}; castSkill(p, id, false, 's0'); run(40); };
  const m = dummy(); const hp0 = m.hp;
  const keys = { sm_lesser: ['sm_ador', 'sm_naias', 'sm_stalker', 'sm_wisp'], sm_frit: ['sm_frit'], sm_sandor: ['sm_sandor'], sm_aukuso: ['sm_aukuso'], sm_merkle: ['sm_merkle'], sm_glarelin: ['sm_glarelin'],
    sm_aqueris: ['sm_aqueris'], sm_flamehulk: ['sm_flamehulk'], sm_luise: ['sm_luise'], sm_echeverria: ['sm_echeverria'], sm_kuruta: ['sm_kuruta'], mg_hodor: ['hodor'] };
  out.spawned = {}; out.sprite = {};
  for (const id in keys) { cast(id); for (const k of keys[id]) { const L = summonsOf(p, k); out.spawned[k] = L.length; out.sprite[k] = !!(L[0] && L[0].model && L[0].model.S); } }
  run(600);
  out.dealt = hp0 - m.hp > 0; out.total = summonsOf(p).length;
  out.attackers = [...new Set(ents.filter(e => e.summon && e.st === 'act').map(e => e.skey))].length;
  // 交感：心灵感应 6 级时，库鲁塔的专属招（recast 钩子还没进 main 时直接下命令）
  const ku = summonsOf(p, 'sm_kuruta')[0]; const n = summonCmd(p, 'sm_kuruta', 'special', {}); run(2); out.cmd = { n, acting: !!(ku && ku.act) };
  // 伺机而动：停火
  cast('sm_wait'); run(120); out.hold = !!(p.summonMode && p.summonMode.hold); out.holdActing = ents.filter(e => e.summon && e.st === 'act' && !e.act.name.startsWith('sm_')).length;
  // 伺机而动：原地停下（你走开也不跟过来）
  { const F = summonsOf(p).filter(s => s.kind === 'follower' && s.skey !== 'sm_hilun'), x0 = F.map(s => s.x), px = p.x; p.x -= 250; run(90); out.holdStay = F.every((s, i) => Math.abs(s.x - x0[i]) < 2); p.x = px; }
  cast('sm_wait');
  // 交感是无动作下令：放别的技能的过程中也能下令，不打断自己的动作
  { p.setState('idle'); p.act = null; p.cool = {}; castSkill(p, 'mg_orb', false, 's0'); run(3); const a0 = p.act && p.act.name, fr = summonsOf(p, 'sm_frit')[0], cc = canCancelInto(p, 'sm_frit'); castSkill(p, 'sm_frit', false, 's1'); run(2);
    out.instant = { a0, cc, a: p.act && p.act.name, fritAct: !!(fr && fr.act && fr.act.name === 'roar') }; }
  // 魔力印记：挂上印记、成为集火目标
  p.x = m.x - 200; p.y = m.y; p.face = 1;
  cast('sm_mark'); out.mark = { attached: summonsOf(p, 'sm_markT').length, target: !!(p.summonMode && p.summonMode.mark)};
  // 献祭：下级精灵被引爆
  const before = summonsOf(p, { tag: 'lesser' }).length; p.x = m.x - 130; p.face = 1; cast('sm_sacrifice'); out.sacrifice = { before, after: summonsOf(p, { tag: 'lesser' }).length };
  // 绝对支配：鞭挞范围变大、增益 40 秒，再按一次追加上挑
  game.skillLv.mg_whip = 5; game.skillLv.sm_domin = 1; const fr = summonsOf(p, 'sm_frit')[0]; if (fr) { fr.warp(p.x + p.face * 200, p.y); fr.busy = false; }
  p.setState('idle'); p.act = null; p.cool = {}; castSkill(p, 'mg_whip', false, 's0'); const wa0 = p.act && p.act.name; for (let i = 0; i < 20 && p.act && p.actT < 0.14; i++) run(1);
  out.domin = { a0: wa0, a: p.act && p.act.name, t: +(p.actT || 0).toFixed(2), cancel: canCancelInto(p, 'mg_whip'), whipT: fr ? Math.round((fr.buffs.whip || {}).t || 0) : -1 }; castSkill(p, 'mg_whip', false, 's0'); out.domin.up = p.act && p.act.name; run(30);
  // 换房间：召唤兽跟到身边
  p.x = 200; game.room = { ...game.room }; run(3); out.room = summonsOf(p).filter(s => s.kind === 'follower' && !s.gone).every(s => Math.abs(s.x - p.x) < 200);
  // 召唤解除
  cast('sm_dismiss'); run(10); out.dismissed = summonsOf(p).filter(s => s.kind === 'follower').length;
  // 一觉：卡西利亚斯出场击倒全部敌人（包括身后的）、放养会出手；千鬼杀；解除时落下狱冥天地
  for (const e of ents) if (e.team === 'e') e.remove = true; run(1);
  p.x = 400; p.y = 100; p.face = 1; const m2 = dummy(); m2.x = 700; m2.y = 100; const m3 = dummy(); m3.x = 150; m3.y = 130;
  p.hp = p.hpMax; const h3 = m3.hp, hpBefore = p.hp; p.setState('idle'); p.act = null; p.cool = {}; castSkill(p, 'sm_awaken', false, 's0'); let inv = true;
  for (let i = 0; i < 200; i++) { run(1); if (p.act && p.act.name === 'sm_awaken' && !(p.invul > 0 || p.act.invul)) inv = false; }
  const cas = summonsOf(p, 'sm_casillas')[0];
  out.awaken = { cas: !!cas, behind: h3 > m3.hp, inv, sprite: !!(cas && cas.model && cas.model.S) };
  out.awaken.hpCost = +((hpBefore - p.hp) / p.hpMax).toFixed(3);
  const h2 = m2.hp; run(360); out.awaken.fights = h2 > m2.hp;
  p.setState('idle'); p.act = null; p.cool = {}; const h2b = m2.hp; castSkill(p, 'sm_thousand', false, 's0'); run(2); out.thousand = { act: cas && cas.act && cas.act.name, pinv: p.invul > 0 }; run(110); out.thousand.dealt = h2b > m2.hp;
  m2.remove = true; const m4 = dummy(); if (cas) { m4.x = cas.x + cas.face * 90; m4.y = cas.y; } const h4 = m4.hp; p.setState('idle'); p.act = null; p.cool = {}; castSkill(p, 'sm_dismiss', false, 's0'); run(160);
  out.gokumei = { gone: summonsOf(p, 'sm_casillas').length === 0, dealt: h4 > m4.hp };
  // P1：海伊伦（贴身、给本体加成）、支配之环（一键召齐）、二觉拉莫斯（出场 + 咒令逆月之蚀打出伤害）
  for (const e of ents) if (e.team === 'e') e.remove = true; run(1); dismissSummons(p); run(2);
  p.x = 400; p.y = 100; p.face = 1; const m5 = dummy(); m5.x = 620; m5.y = 100;
  cast('sm_hilun'); run(30); out.p1 = { hilun: summonsOf(p, 'sm_hilun').length, hbuff: !!p.buffs.sm_hilunAura };
  cast('sm_ring'); run(60); out.p1.ring = summonsOf(p).filter(s => s.kind === 'follower').length;
  cast('sm_awaken2'); for (let i = 0; i < 150; i++) run(1); const lam = summonsOf(p, 'sm_lamos')[0]; out.p1.lamos = !!lam; out.p1.lamSprite = !!(lam && lam.model && lam.model.S);
  const h5 = m5.hp; cast('sm_lamoseclipse'); run(150); out.p1.eclipse = h5 > m5.hp;
  // 现版改动：桑德尔守护光环常驻给你减伤；受身蹲伏时海伊伦让召唤兽无敌；决斗场里精灵瞬移 / 死亡爆炸
  dismissSummons(p); run(2); p.x = 400; p.y = 100; cast('sm_sandor'); run(40); out.guard = p.buffs.sm_guard ? p.buffs.sm_guard.taken : 0;
  cast('sm_hilun'); run(30); cast('sm_frit'); run(30); p.techHold = true; run(30); const fri = summonsOf(p, 'sm_frit')[0]; out.techInv = !!(fri && fri.invul > 0.5); p.techHold = false;
  dismissSummons(p); run(2); game.pvp = true; cast('sm_lesser'); cast('sm_aqueris'); const wi = summonsOf(p, 'sm_wisp')[0], aq = summonsOf(p, 'sm_aqueris')[0];
  out.pvpHp = !!(wi && wi.hp > 0 && wi.invul === 0); if (wi) { wi.warp(500, 100); wi.onHurt({ x: 300, y: 100, face: 1 }, {}); out.wispBlink = Math.abs(wi.x - 240) < 5; }
  const dm = dummy(); dm.x = aq.x; dm.y = aq.y; const hq = dm.hp; dismissOne(aq, 'dead'); run(5); out.deathBlast = hq > dm.hp; game.pvp = false;
  return out;
});
const o = R;
report('全部召唤兽都能召出', Object.values(o.spawned).every(n => n >= 1), o.spawned);
report('召唤兽用正式精灵美术（不是兜底光球）', Object.values(o.sprite).every(Boolean), o.sprite);
report('召唤兽会出手、打得出伤害', o.dealt && o.attackers >= 5, { dealt: o.dealt, attackers: o.attackers, total: o.total });
report('交感 / 命令：库鲁塔放专属招', o.cmd.n === 1 && o.cmd.acting, o.cmd);
report('伺机而动：停火、原地停下', o.hold && o.holdActing === 0 && o.holdStay, { hold: o.hold, acting: o.holdActing, stay: o.holdStay });
report('交感：放技能中也能下令、不打断自己', o.instant.a0 === 'mg_orb' && o.instant.cc && o.instant.a === 'mg_orb' && o.instant.fritAct, o.instant);
report('魔力印记：挂上并成为集火目标', o.mark.attached === 1 && o.mark.target, o.mark);
report('精灵献祭：阵里的下级精灵被引爆', o.sacrifice.after < o.sacrifice.before, o.sacrifice);
report('绝对支配：远处的召唤兽吃到 40 秒鞭挞增益、再按追加上挑', o.domin.cancel && o.domin.whipT >= 39 && o.domin.up === 'mg_whipUp', o.domin);
report('换房间：召唤兽跟到身边', o.room, o.room);
report('召唤解除：全部消失', o.dismissed === 0, o.dismissed);
report('一觉：卡西利亚斯出场、落地击倒身后的敌人、召唤过程本体无敌、放养会出手', o.awaken.cas && o.awaken.sprite && o.awaken.behind && o.awaken.inv && o.awaken.fights, o.awaken);
report('千鬼杀：卡西利亚斯放专属招、本体无敌、打出伤害', o.thousand.act === 'casThousand' && o.thousand.pinv && o.thousand.dealt, o.thousand);
report('狱冥天地：解除时剑阵落下打出伤害', o.gokumei.gone && o.gokumei.dealt, o.gokumei);
report('P1：海伊伦 / 支配之环 / 拉莫斯 / 逆月之蚀', o.p1.hilun === 1 && o.p1.hbuff && o.p1.ring >= 14 && o.p1.lamos && o.p1.lamSprite && o.p1.eclipse, o.p1);
report('桑德尔：守护光环常驻减伤；卡西利亚斯召唤消耗 HP', o.guard < 0 && o.awaken.hpCost >= 0.03 && o.awaken.hpCost <= 0.11, { guard: o.guard, hpCost: o.awaken.hpCost });
report('海伊伦：受身蹲伏时召唤兽无敌', o.techInv, o.techInv);
report('决斗场：召唤兽有 HP、雷沃斯被打后瞬移到攻击者背后、上级精灵死亡爆炸', o.pvpHp && o.wispBlink && o.deathBlast, { hp: o.pvpHp, blink: o.wispBlink, blast: o.deathBlast });
const errs = logs.filter(l => /error|Error/.test(l)); report('无报错', errs.length === 0, errs.slice(0, 3));
await browser.close();
console.log(fail ? `${fail} 项失败` : '全部通过'); process.exit(fail ? 1 : 0);
