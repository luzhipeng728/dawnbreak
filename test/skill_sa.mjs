// 技能霸体：地下城里玩家放技能不会被怪物打断（普攻照常会被打断）；决斗场不受影响
import { launch, URL_BASE } from './lib.mjs';
let fail = 0; const ok = (c, m, x = '') => { console.log(c ? '  ✓' : '  ✗', m, x); if (!c) fail++; };
const { browser, page, logs } = await launch({ width: 1280, height: 720 });
await page.goto(`${URL_BASE}?test&mute&cls=gun&mon=tauSoldier,tauSoldier,goblin,goblin&lvl=10`); await page.waitForFunction(() => window.__READY); await page.waitForTimeout(800);
const run = (mode) => page.evaluate(async mode => {
  const p = game.player; p.hpMax = p.hp = 1e7; p.mp = p.mpMax = 99999; for (const k in p.cool) p.cool[k] = 0;
  for (const e of ents) if (e.team === 'e') { e.x = p.x + 40 + Math.random() * 30; e.y = p.y + (Math.random() - 0.5) * 10; e.hp = e.hpMax = 1e9; }   // 怪物贴身、打不死
  let hits = 0, interrupted = 0, samples = 0, prevSkill = false;
  const h0 = game.onPlayerHurt.bind(game); game.onPlayerHurt = function (t, d) { hits++; return h0(...arguments); };
  // 精确判定：技能动作进行中被切成受击 / 浮空 / 倒地，才算被打断
  const ss = p.setState; let cut = 0; p.setState = function (st, ...a) { if (this.st === 'act' && this.act && this.act.skill && ['hit', 'air', 'down'].includes(st)) cut++; return ss.call(this, st, ...a); };
  const t0 = performance.now();
  while (performance.now() - t0 < 4000) {
    if (mode === 'skill') { if (p.st !== 'act' || !p.act || !p.act.skill) { for (const k in p.cool) p.cool[k] = 0; const id = ['g_gatling', 'g_m3', 'g_bbq'].find(id => SKILLS[id] && (game.skillLv[id] || 0) > 0) || game.skillBar.find(Boolean); castSkill(p, id, false); } }
    else { input.virt.attack = 2; }
    await new Promise(r => setTimeout(r, 50)); samples++;
    const hurt = ['hit', 'air', 'down'].includes(p.st);
    if (hurt && (mode === 'basic' || prevSkill)) interrupted++;   // 技能：只算“上一刻还在放技能、这一刻变成受击”
    prevSkill = p.st === 'act' && !!p.act && !!p.act.skill;
  }
  game.onPlayerHurt = h0; p.setState = ss; delete input.virt.attack;
  return { hits, interrupted: mode === 'skill' ? cut : interrupted, samples };
}, mode);
await page.evaluate(() => { for (const id of ['g_gatling', 'g_m3', 'g_bbq']) if (SKILLS[id]) game.skillLv[id] = 5; });
const s = await run('skill');
ok(s.hits >= 2 && s.interrupted === 0,   /* 被打中次数随怪物 AI 随机，只要确实挨了打且 0 次打断即可 */ `放技能时被怪物打中 ${s.hits} 次，被打断 0 次（霸体）`, JSON.stringify(s));
await page.evaluate(() => { const p = game.player; p.setState('idle'); p.act = null; });
const b = await run('basic');
ok(b.hits >= 1 && b.interrupted > 0, `普攻时被打中 ${b.hits} 次，会被打断（${b.interrupted} 次采样处于受击）`, JSON.stringify(b));
const pvp = await page.evaluate(() => { game.pvp = true; const p = game.player; p.st = 'act'; p.act = { skill: 'g_gatling' }; const r = hasSA(p); game.pvp = false; p.act = null; p.setState('idle'); return r; });
ok(!pvp, '决斗场里没有额外的技能霸体（保持原设定）');
const errs = logs.filter(l => l.type === 'pageerror'); ok(!errs.length, '没有页面错误', errs.length ? errs[0].text.slice(0, 200) : '');
await browser.close();
console.log(fail ? `${fail} 项失败` : '全部通过'); process.exit(fail ? 1 : 0);
