// 天空之城测试：数据完整性 + 每种新怪物都能生成 / 会出手 / 能被打死；每个领主的每一招都强制放一遍（看有没有报错、有没有地面预警）
// 用法：node build.mjs --offline && node test/sky.mjs [怪物id,...]
// 截图：test/shots/sky/<怪物>.png（请人工看图）；机器人通关另用 test/botrun.mjs（见 docs/CONTENT_GUIDE.md）
import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';
const out = 'test/shots/sky'; fs.mkdirSync(out, { recursive: true });
const NORMAL = ['wyvern', 'wyvernBlue', 'dragonman', 'minius', 'puppeteer', 'puppeteerRock', 'puppeteerIce', 'golem', 'golemBronze', 'golemMaster', 'kargo', 'kargoGoggle', 'expeller', 'expellerAxe', 'knight', 'hughes', 'lucasClone', 'dragonStatue'];
const BOSS = ['lucas', 'dogrey', 'platani', 'skyExpeller', 'seghart', 'sinEye'];
const only = process.argv[2] ? process.argv[2].split(',') : null;
const KINDS = (only || [...NORMAL, ...BOSS]);
const DUNGEON_IDS = ['dragon_tower', 'puppet_hall', 'golem_tower', 'dark_corridor', 'lord_palace', 'floating_castle'];
let fail = 0;
const check = (ok, msg) => { if (!ok) { fail++; console.log('FAIL', msg); } };

const { browser, page, logs } = await launch({ width: 1280, height: 720 });
await page.goto(`${URL_BASE}?test&mute&mon=${KINDS.join(',')}`);
await page.waitForFunction(() => window.__READY, null, { timeout: 30000 });

// ---- 1. 数据完整性 ----
const data = await page.evaluate((ids) => {
  const errs = [];
  for (const id of ids) {
    const D = DUNGEONS[id]; if (!D) { errs.push('缺少地下城 ' + id); continue; }
    for (const [k] of D.mobs) if (!MON[k]) errs.push(`${id}: 未定义的怪物 ${k}`);
    for (const k of [D.elite, D.boss.kind]) if (!MON[k]) errs.push(`${id}: 未定义的怪物 ${k}`);
    if (!THEMES[D.theme]) errs.push(`${id}: 未定义的主题 ${D.theme}`);
    if (!BG_GRADE[D.theme]) errs.push(`${id}: 主题 ${D.theme} 没有色调`);
    if (!(D.lvl[0] <= D.lvl[1] && D.boss.lvl > D.lvl[1])) errs.push(`${id}: 等级不合理 ${D.lvl} / 领主 ${D.boss.lvl}`);
    for (const k of [...D.mobs.map(m => m[0]), D.elite, D.boss.kind]) if (!MON_ART[k]) errs.push(`${id}: ${k} 没有 MON_ART`);
    for (const b of monBundles([...D.mobs.map(m => m[0]), D.boss.kind, D.elite])) if (!Object.values(ASSET_BUNDLE).includes(b)) errs.push(`${id}: 分包 ${b} 没有素材`);
    for (const k of ['far', 'floor', 'edge']) if (!ASSET_SRC[`bg/${D.theme}_${k}`]) errs.push(`${id}: 缺少背景 bg/${D.theme}_${k}`);
  }
  const S = SCENES.sky_castle; if (!S) errs.push('缺少区域 sky_castle');
  else { for (const g of S.gates) if (!DUNGEONS[g.dungeon]) errs.push('区域里的门指向不存在的地下城 ' + g.dungeon); if (S.gates.filter(g => !(DUNGEONS[g.dungeon] || {}).abyss).length !== ids.length) errs.push('区域的门数量不对'); }   // 深渊派对的门（装备深化，content/abyss.js）不算
  const lv = ids.map(id => DUNGEONS[id]).filter(D => !D.hidden).map(D => D.lvl[0]);
  if (lv.some((v, i) => i && v < lv[i - 1])) errs.push('地下城等级没有从左到右递增');
  return errs;
}, DUNGEON_IDS);
for (const e of data) check(false, e);
console.log(`数据检查：${data.length ? data.length + ' 个问题' : '通过'}`);

// ---- 2. 逐个怪物 ----
await page.evaluate(() => {
  window.__acts = []; window.__tele = 0; window.__hurt = 0;
  const od = Ent.prototype.doAct; Ent.prototype.doAct = function (def, extra) { if (this.team === 'e') __acts.push({ kind: this.kind, i: def.__i ?? -1, name: def.name }); return od.call(this, def, extra); };
  const ot = telegraph; telegraph = o => { __tele++; return ot(o); };
  const oh = game.onPlayerHurt.bind(game); game.onPlayerHurt = (pp, dmg, a) => { __hurt++; oh(pp, dmg, a); };
  for (const k in MON) (MON[k].attacks || []).forEach((A, i) => { A.act.__i = i; });
  const p = __G.player; setInterval(() => { p.hp = p.hpMax; p.mp = p.mpMax; }, 50);
  game.speedMul = 3;
});
const rows = [];
for (const kind of KINDS) {
  const boss = BOSS.includes(kind);
  await page.evaluate(({ kind, boss }) => {
    for (let i = ents.length - 1; i >= 0; i--) if (ents[i].team === 'e') ents.splice(i, 1);
    groundFx.length = 0; projs.length = 0; __acts.length = 0; window.__tele = 0; window.__hurt = 0;
    const p = __G.player; p.x = 300; p.y = 100; p.status = {}; if (p.act) p.endAct(); p.setState('idle');
    const m = spawnMonster(kind, 560, 100, { lvl: MON[kind].lvl, boss });
    if (kind === 'dragonStatue') { m.control = skyStatueAI; m.aiCd = 0.5; }
    window.__m = m;
  }, { kind, boss });
  // 领主：每一招都强制放一遍
  const nAtk = await page.evaluate(k => MON[k].attacks.length, kind);
  if (boss) for (let i = 0; i < nAtk; i++) {
    await page.evaluate(i => {
      const m = __m; if (m.dead) return; if (m.act) m.endAct(); m.setState('idle'); m.stun = 0;
      const A = m.def_.attacks[i]; m.face = __G.player.x >= m.x ? 1 : -1;
      m.doAct({ name: A.clip, clip: A.clip, ...A.act, events: (A.act.events || []).map(ev => ({ ...ev, done: false })), hits: A.act.hits && A.act.hits.map(h => ({ ...h })) });
    }, i);
    await page.waitForTimeout(350);
    await page.screenshot({ path: `${out}/${kind}-a${i}.png` });   // 预警刚出现的时候
    await page.waitForTimeout(1150);
  }
  // 自由行动：玩家站着挨打，看怪物会不会主动出手
  await page.waitForTimeout(boss ? 5000 : 4000);
  // 玩家可能刚好被打倒在地（怪物不会打倒地的人）：再多等一会儿，直到它自己出过手
  if (kind !== 'dragonStatue') await page.waitForFunction(() => __acts.some(a => a.kind === __m.kind && a.i >= 0 && a.name !== 'statue'), null, { timeout: 8000 }).catch(() => {});
  await page.screenshot({ path: `${out}/${kind}.png` });
  const r = await page.evaluate(() => {
    const m = __m, acts = __acts.filter(a => a.kind === m.kind);
    const sprite = !!(m.model && m.model.constructor && m.model.constructor.name === 'SpriteModel');
    const used = [...new Set(acts.map(a => a.i))].sort();
    // 打死
    const p = __G.player; m.invul = 0; if (m.act && m.act.name === 'statue') m.endAct();
    m.hp = 1; applyHit(p, m, { dmg: 50, knock: 50, stun: 0.2, hs: 0.02 }, { proj: true });
    return { hp: m.hpMax, sprite, used: used.join(' '), nAtk: m.def_.attacks.length, tele: __tele, hurt: __hurt, dead: m.dead };
  });
  const lv = await page.evaluate(k => MON[k].lvl, kind);
  rows.push({ kind, lv, boss, ...r });
  check(r.dead, `${kind} 打不死`);
  check(r.sprite, `${kind} 没有逐帧精灵`);
  if (kind !== 'dragonStatue') check(r.used.length > 0, `${kind} 没有出手`);
  if (boss) { const used = r.used.split(' ').map(Number); for (let i = 0; i < r.nAtk; i++) check(used.includes(i), `${kind} 第 ${i} 招没有触发`); check(r.tele > 0, `${kind} 没有地面预警`); }
}
console.table(rows);
const errs = logs.filter(l => l.type !== 'warning');
for (const e of errs.slice(0, 8)) console.log('ERR', e.text.slice(0, 400));
check(!errs.length, `页面报错 ${errs.length} 条`);
await browser.close();
console.log(fail ? `sky: ${fail} 项失败` : 'sky: 全部通过');
process.exit(fail ? 1 : 0);
