// 男格斗家上线前的整条流程（B9，docs/CLASS_PLAN_FIGHTER.md §6）：网址带 ?fighter=1（开关没打开也能测），真实存档（localStorage），不连服务器
//   1) 选角界面建一个格斗家（真实点按钮），再用存档接口建另外 3 个；每个都升到 30 级 → 做完转职试炼 → doJobChange 转成 4 个方向之一 → 学技能 / 三次觉醒
//   2) 三个不同转职（气功师 / 街霸 / 柔道家）用机器人各打通一次地下城
//   3) 散打用自己的技能栏打一局决斗场（对手 AI，公正决斗）
//   4) 存档往返：刷新后 4 个角色的职业 / 转职 / 等级 / 技能 / 技能栏原样；不带 ?fighter=1（没开放）时角色原样保留、选角显示“需要更新”、写回存档不丢不改
//   5) 选角界面：4 张格斗家卡片显示转职名；新建角色里格斗家卡片（没开放时显示“即将开放”）
// 用法：node test/fighter_launch.mjs [地下城=lorien]（约 1~2 分钟；截图 test/shots/fighter_launch/）
import fs from 'node:fs';
import { launch, URL_BASE } from './lib.mjs';
const DG = process.argv[2] || 'lorien';
const out = 'test/shots/fighter_launch'; fs.mkdirSync(out, { recursive: true });
const { browser, page, logs } = await launch({ width: 1280, height: 720 });
let fails = 0;
const ok = (c, msg, x) => { if (c) console.log('✓', msg); else { fails++; console.log('✗', msg, x !== undefined ? JSON.stringify(x).slice(0, 800) : ''); } return !!c; };
const until = async (fn, arg, ms = 30000) => { try { await page.waitForFunction(fn, arg, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; } };
const JOBS = ['nenmaster', 'striker', 'brawler', 'grappler'], NAMES = { nenmaster: '测试气功', striker: '测试散打', brawler: '测试街霸', grappler: '测试柔道' };
const open = async (q = '&fighter=1') => { await page.goto(`${URL_BASE}?mute${q}`); await page.waitForFunction(() => window.__READY, null, { timeout: 60000 }); };
try {
  await open();
  await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (/^dawnbreak/.test(k)) localStorage.removeItem(k); });
  await open();
  // ---- 1) 建角色：第一个走真实界面 ----
  await page.evaluate(() => { while (menus.stack.length) menus.close(menus.stack[menus.stack.length - 1]); menus.open('newgame'); });
  await until(() => document.querySelector('#newgame .clscard[data-cls=fighter]'));
  const card = await page.evaluate(() => { const c = document.querySelector('#newgame .clscard[data-cls=fighter]'); return c ? { off: c.classList.contains('off'), txt: c.textContent } : null; });
  ok(card && !card.off, '新建角色：?fighter=1 时格斗家卡片可选', card);
  await page.click('#newgame .clscard[data-cls=fighter]');
  await page.fill('#newgame input.txt', NAMES.nenmaster);
  await page.click('text=创建并开始');
  ok(await until(() => game.scene === 'town' && game.player && game.player.cls === 'fighter'), '真实界面创建格斗家并进城');
  const made = await page.evaluate(({ JOBS, NAMES }) => { for (const j of JOBS.slice(1)) { save.newGame('fighter', NAMES[j]); save.persist(); } save.loadAll(); return save.chars.map(c => c.cls + ':' + c.name); }, { JOBS, NAMES });
  ok(made.length === 4 && made.every(s => s.startsWith('fighter:')), '另外 3 个用存档接口创建（共 4 个格斗家）', made);
  // 每个角色：升 30 级 → 转职试炼 → 转职（真实的 doJobChange）→ 学技能、三次觉醒、技能栏
  for (const [i, job] of JOBS.entries()) {
    const r = await page.evaluate(async ({ i, job }) => {
      save.select(i); save.apply(); await startGame(save.data.cls);
      testLoadout(30);
      const J = CLASSES.fighter.jobs[job], d = qdata(); d.questDone.q_job_fighter_final = Date.now(); if (J.trial) d.questDone[J.trial] = Date.now();
      const changed = doJobChange(job);
      Object.assign((save.data.flags ??= {}), { awaken: true, awaken2: true, awaken3: true });
      const ids = classSkills('fighter', job).filter(id => SKILLS[id].job === job && SKILLS[id].lvReq <= 30);
      for (const id of ids) game.skillLv[id] = Math.max(1, Math.min(SKILLS[id].maxLv, 1 + Math.floor((30 - SKILLS[id].lvReq) / 3)));
      const act = ids.filter(id => !SKILLS[id].passive && (SKILLS[id].act || SKILLS[id].instant));
      game.skillBar = [...act.filter(id => !SKILLS[id].awaken).slice(0, 11), ...act.filter(id => SKILLS[id].awaken)].slice(0, 14); while (game.skillBar.length < 14) game.skillBar.push(null);
      recalcStats(game.player); game.player.hp = game.player.hpMax; game.player.mp = game.player.mpMax; save.write();
      const P = game.player; return { changed, job: game.job, lvl: game.lvl, name: save.data.name, n: ids.length, mag: J.dmgType === 'mag', atk: Math.round(P.atk), matk: Math.round(P.matk) };
    }, { i, job });
    ok(r.changed && r.job === job && r.lvl === 30 && r.mag === (job === 'nenmaster' || job === 'brawler'), `${r.name}：30 级，转职成「${await page.evaluate(j => CLASSES.fighter.jobs[j].name, job)}」（${r.n} 个转职技能，${r.mag ? '魔法' : '物理'}）`, r);
  }
  // ---- 2) 三个转职各打通一次地下城（机器人）----
  for (const job of ['nenmaster', 'brawler', 'grappler']) {
    const i = JOBS.indexOf(job);
    await page.evaluate(async i => { if (menus.stack.length) while (menus.stack.length) menus.close(menus.stack[menus.stack.length - 1]); save.select(i); save.apply(); await startGame(save.data.cls); }, i);
    await until(() => game.scene === 'town' && game.player);
    await page.evaluate(dg => { window.__botDone = null; bot.on = true; game.speedMul = 3; enterDungeon(dg, 0); }, DG);
    const inDg = await until(() => game.scene === 'dungeon', null, 20000);
    const done = inDg && await until(() => window.__botDone || (game.dungeon && game.dungeon.state === 'failed'), null, 240000);
    const r = await page.evaluate(() => ({ done: window.__botDone, job: game.job, kills: game.dungeon && game.dungeon.kills, failed: game.dungeon && game.dungeon.state === 'failed' }));
    ok(inDg && done && r.done && r.done.rank && !r.failed && r.kills > 0 && r.job === job, `${job}：机器人打通「${DG}」（评价 ${r.done && r.done.rank}，击杀 ${r.kills}，${r.done && r.done.time} 秒）`, r);
    if (job === 'grappler') await page.screenshot({ path: `${out}/result-${job}.png` });
    await page.evaluate(() => { bot.on = false; game.speedMul = 1; const b = [...document.querySelectorAll('#result button')].find(x => x.textContent === '返回城镇'); if (b) b.click(); });
    await until(() => game.scene === 'town', null, 20000);
  }
  // ---- 3) 散打打一局决斗（自己的技能栏，AI 对手，公正决斗）----
  const duelR = await page.evaluate(async i => {
    save.select(i); save.apply(); await startGame(save.data.cls); save.write();
    const me = JSON.parse(JSON.stringify(save.data)); save.live = false;
    await loadBundles(['spr:fighter', 'spr:sword']);
    game.paused = true;
    duel.start({ a: 'fighter', ja: me.job, b: 'sword', jb: 'blade', lv: DUEL_CFG.lv, ai: 2, auto: true, theme: 'ruinsDark', nameA: me.name, me: { skillBar: me.skillBar } });
    const snap = duelFairSnap(duel.a), bar = game.skillBar.filter(Boolean);
    for (let k = 0; k < 60 * 110 && duel.state !== 'result' && duel.state !== 'done'; k++) step(1 / 60);
    const res = duel.result; game.paused = false;
    return { res, snap, bar, own: me.skillBar.filter(Boolean), wantHp: Math.round(DUEL_BASE.fighter.hp * DUEL_CFG.hpMul) };
  }, JOBS.indexOf('striker'));
  ok(duelR.res && duelR.res.a === 'fighter:striker' && duelR.res.rounds.length === 1, `散打决斗：打完一局（${duelR.res && (duelR.res.winner === 0 ? '赢' : duelR.res.winner === 1 ? '输' : '平')}，${duelR.res && duelR.res.rounds[0] && duelR.res.rounds[0].time} 秒）`, duelR.res);
  ok(duelR.snap.hpMax === duelR.wantHp && duelR.snap.lvl === 30 && duelR.snap.procs === 0 && /fs_/.test(duelR.snap.skills) && duelR.bar.every(id => duelR.own.includes(id)), `决斗用公正属性（Lv30、HP ${duelR.snap.hpMax}、没有装备特效）+ 自己的技能栏`, { snap: duelR.snap, bar: duelR.bar });
  // ---- 4) 存档往返 ----
  const pick = () => page.evaluate(() => { save.loadAll(); return save.chars.map(c => JSON.stringify({ cls: c.cls, job: c.job, lvl: c.lvl, name: c.name, bar: c.skillBar, sk: c.skillLv, fl: c.flags })); });
  await open(); const A = await pick();
  ok(A.length === 4 && A.every((s, i) => JSON.parse(s).job === JOBS[i] && JSON.parse(s).lvl === 30), '刷新后：4 个格斗家的转职 / 等级都在', A.map(s => JSON.parse(s).job));
  const raw0 = await page.evaluate(() => localStorage.getItem(save.key));
  await open(''); const B = await page.evaluate(() => { save.loadAll(); return { n: save.chars.length, open: save.chars.map(c => charOpen(c)), ready: clsOpen('fighter') }; });
  ok(B.n === 4 && B.open.every(v => !v) && !B.ready, '不带 ?fighter=1（格斗家没开放）：角色原样保留，但不能进（charOpen = false）', B);
  await page.evaluate(() => { while (menus.stack.length) menus.close(menus.stack[menus.stack.length - 1]); menus.open('charselect'); });
  await until(() => document.querySelectorAll('#charsel .cslot.off').length === 4, null, 8000);
  const csOff = await page.evaluate(() => [...document.querySelectorAll('#charsel .cslot.off .job')].map(e => e.textContent));
  ok(csOff.length === 4 && csOff.every(t => t === '需要更新'), '选角：没开放时 4 张卡片显示“需要更新”', csOff);
  await page.screenshot({ path: `${out}/charselect-closed.png` });
  await page.evaluate(() => { menus.close('charselect'); menus.open('newgame'); });
  await until(() => document.querySelector('#newgame .clscard[data-cls=fighter]'), null, 8000);
  const soon = await page.evaluate(() => { const c = document.querySelector('#newgame .clscard[data-cls=fighter]'); return { off: c.classList.contains('off'), txt: c.textContent }; });
  ok(soon.off && /即将开放/.test(soon.txt), '新建角色：没开放时格斗家卡片显示“即将开放”、点不了', soon);
  await page.evaluate(() => { menus.close('newgame'); save.loadAll(); save.persist(); });
  const raw1 = await page.evaluate(() => localStorage.getItem(save.key));
  const strip = r => { const o = JSON.parse(r); return JSON.stringify(o.chars.map(c => ({ cls: c.cls, job: c.job, lvl: c.lvl, name: c.name, skillBar: c.skillBar, skillLv: c.skillLv, flags: c.flags, equip: c.inv && c.inv.equip }))); };
  ok(strip(raw1) === strip(raw0), '没开放的版本写回存档：格斗家角色的数据一个字不改');
  await open(); const C = await pick();
  ok(JSON.stringify(C) === JSON.stringify(A), '再打开 ?fighter=1：和写回前完全一样（职业 / 转职 / 等级 / 技能 / 技能栏 / 觉醒）');
  // ---- 5) 选角界面（开放时）----
  await page.evaluate(() => { while (menus.stack.length) menus.close(menus.stack[menus.stack.length - 1]); menus.open('charselect'); });
  await until(() => document.querySelectorAll('#charsel .cslot[data-i]').length === 4, null, 8000);
  const cs = await page.evaluate(() => [...document.querySelectorAll('#charsel .cslot[data-i]')].map(e => ({ off: e.classList.contains('off'), job: e.querySelector('.job').textContent, art: !!e.querySelector('canvas,img,.cart') })));
  const names = await page.evaluate(J => J.map(j => CLASSES.fighter.jobs[j].name), JOBS);
  ok(cs.length === 4 && cs.every((c, i) => !c.off && c.job === names[i] && c.art), `选角：4 张卡片显示转职名（${cs.map(c => c.job).join(' / ')}）和人物`, cs);
  await page.screenshot({ path: `${out}/charselect.png` });
  const startOk = await page.evaluate(async () => { save.select(3); save.apply(); menus.close('charselect'); await startGame(save.data.cls); return { scene: game.scene, cls: game.player && game.player.cls, job: game.job }; });
  ok(startOk.scene === 'town' && startOk.cls === 'fighter' && startOk.job === 'grappler', '从选角进入柔道家角色（进城）', startOk);
} catch (e) { ok(false, '异常：' + (e.stack || e)); }
const errs = logs.filter(l => l.type === 'pageerror');
ok(!errs.length, '没有页面报错', errs.slice(0, 3));
await browser.close();
console.log(fails ? `\n${fails} 项失败` : '\n全部通过');
process.exit(fails ? 1 : 0);
