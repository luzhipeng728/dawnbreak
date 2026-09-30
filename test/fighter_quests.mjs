// 格斗家（男）转职 / 觉醒任务线（B8，docs/CLASS_PLAN_FIGHTER.md §2.5；content/quests/fighter.js + quests/job.js 的 JOB_CHAINS.fighter）。
// node test/fighter_quests.mjs [inert,data,chain]（默认全部，约 1 分钟）
//   inert  没开放（不带 ?fighter=1）：鬼剑士角色看不到任何格斗家任务，NPC 身上也没有；转职窗口数据不受影响
//   data   ?fighter=1：每个格斗家任务引用的 NPC / 地下城 / 怪物 / 道具 / 图标 / 前置都存在；四个转职登记了 quests / trial；觉醒等级 21 / 26 / 30
//   chain  ?fighter=1 新建格斗家：林纳斯 → 拜访风振（真实 NPC 对话）→ 风拳流六式 → 出师之战 → 转职窗口接气功师的任务线（换方向会放弃进行中的一步）
//          → 转职 → 一觉剧情 → 一 / 二 / 三觉；另外三个转职用接口各走一遍（转职任务线 → 转职 → 三次觉醒），不报错
import { launch, URL_BASE } from './lib.mjs';
const MODES = (process.argv[2] || 'inert,data,chain').split(',');
let fail = 0;
const report = (name, ok, info) => { if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${JSON.stringify(info)}`); };
const ready = page => page.waitForFunction(() => window.__READY, null, { timeout: 30000 });
const { browser, page, logs } = await launch({ width: 1600, height: 900 });
const wait = ms => page.waitForTimeout(ms), ev = (fn, arg) => page.evaluate(fn, arg);
const closeAll = () => ev(() => { while (menus.stack.length) menus.close(menus.stack[menus.stack.length - 1]); });
// 页面里的小工具：按任务目标发事件把目标凑齐（通关 / 击杀 / 收集 / 对话 / 上交物品），然后接取 → 交付
const install = () => ev(() => {
  window.FQ = {
    ids: () => Object.values(QUESTS).filter(q => [].concat(q.cls || []).includes('fighter')).map(q => q.id),
    satisfy(id) {
      const q = QUESTS[id], r = Math.random; Math.random = () => 0;
      try {
        for (const g of q.goals) {
          const dg = g.dungeon && [].concat(g.dungeon)[0];
          if (g.type === 'item') { inv.add(makeItem(g.key, g.n)); continue; }
          for (let k = 0; k < g.n; k++) {
            if (g.type === 'clear') bus.emit('dungeonClear', { id: dg, diff: g.diff || 0, rank: 'SSS', time: 60, hurt: 0 });
            else if (g.type === 'kill') bus.emit('kill', { kind: [].concat(g.kind || 'goblin')[0], dungeon: dg, boss: !!g.boss, elite: !!g.elite, lvl: 20 });
            else if (g.type === 'collect') bus.emit('kill', { kind: [].concat(g.from || 'goblin')[0], dungeon: dg, boss: true, lvl: 20 });
            else if (g.type === 'talk') bus.emit('npcTalk', { id: g.npc });
          }
        }
      } finally { Math.random = r; }
      return questState(id);
    },
    run(id) { const acc = questState(id) === 'avail' && questAccept(id); const st = this.satisfy(id); const got = questComplete(id); return { id, acc, st, ok: !!got && questDone(id) }; },
    runAll(ids) { const R = ids.map(id => this.run(id)); return { ok: R.every(r => r.ok), bad: R.filter(r => !r.ok) }; },
  };
});
async function npcQuest(npc, qname, btn) {
  await ev(id => { const S = qSceneOfNpc(id); if (S && world.S.id !== S.id) return enterScene(S.id); }, npc); await wait(400);
  await ev(id => { const e = world.npcs.find(x => x.npc.id === id); if (e) { game.player.x = e.x - 40; game.player.y = e.y; } }, npc); await wait(150);
  await closeAll(); await ev(id => openNpc(NPCS[id]), npc); await wait(300);
  const it = page.locator(`.npcmenu .qitem:has-text("${qname}")`); if (await it.count()) { await it.first().click(); await wait(200); }
  for (let i = 0; i < 12; i++) {
    const b = page.locator(`.npcwin .qbtns .btn:has-text("${btn}")`);
    if (await b.count()) { await b.first().click(); await wait(300); return true; }
    await page.click('.npcwin .qbtns .btn'); await wait(120);
  }
  return false;
}

// ---------------- inert ----------------
if (MODES.includes('inert')) {
  await page.goto(`${URL_BASE}?town&cls=sword&mute&notype`); await ready(page); await wait(400); await closeAll(); await install();
  const R = await ev(() => {
    const ids = FQ.ids(), d = save.data;
    game.lvl = 30; for (const id of ['q_job_kill', 'q_job_fighter_final', 'q_awaken_fighter_1', 'q_hidden_dark']) d.questDone[id] = 1;
    const visible = ids.filter(id => !d.questDone[id] && questState(id) !== 'locked');
    const onNpc = ['linus', 'fengzhen', 'sharan', 'norton', 'boken'].flatMap(n => questsOfNpc(n)).filter(id => ids.includes(id));
    for (const id of ['q_job_fighter_final', 'q_awaken_fighter_1', 'q_hidden_dark']) delete d.questDone[id];
    const named = Object.keys(QUESTS).filter(id => /fighter|nenmaster|striker|brawler|grappler/.test(id));
    return { cls: game.player.cls, open: clsOpen('fighter'), jobs: jobsOf('fighter'), n: ids.length, visible, onNpc, strayCls: named.filter(id => QUESTS[id].cls !== 'fighter'),
      swordCond: ['q_awaken_sword_2', 'q_job_visit_sword', 'q_job_sword_final'].map(id => QUESTS[id] && typeof QUESTS[id].cond), swordJobs: Object.values(CLASSES.sword.jobs).filter(J => J.quests).length,
      reg: Object.values(CLASSES.fighter.jobs).map(J => (J.quests || []).length) };
  });
  report('没开放：鬼剑士角色（Lv.30、前置都做完）看不到任何格斗家任务', R.cls === 'sword' && !R.open && R.jobs === null && R.n >= 37 && !R.visible.length && !R.onNpc.length, { n: R.n, visible: R.visible.slice(0, 5), onNpc: R.onNpc.slice(0, 5) });
  report('格斗家任务全部 cls: fighter；鬼剑士的转职 / 觉醒任务没被改（没有 cond、转职没有任务线）', !R.strayCls.length && R.swordCond.every(t => t === 'undefined') && R.swordJobs === 0, { stray: R.strayCls, cond: R.swordCond, swordJobs: R.swordJobs });
  report('四个转职登记了任务线（没开放时也在，但接不到）', R.reg.join() === '3,3,4,4', R.reg);
}

// ---------------- data / chain（?fighter=1）----------------
if (MODES.includes('data') || MODES.includes('chain')) {
  await page.goto(`${URL_BASE}?town&cls=fighter&fighter=1&mute&notype`); await ready(page); await wait(600); await closeAll(); await install();
}
if (MODES.includes('data')) {
  const D = await ev(() => {
    const B = [], ids = FQ.ids();
    for (const id of ids) {
      const q = QUESTS[id];
      if (!q.name || !q.talk.offer.length) B.push(`${id} 缺名字 / 接取台词`);
      for (const n of [q.npc, q.to]) if (!NPCS[n] || !qSceneOfNpc(n)) B.push(`${id} NPC ${n}`);
      for (const p of q.pre) if (!QUESTS[p]) B.push(`${id} 前置 ${p}`);
      for (const g of q.goals) {
        if (g.dungeon) for (const dg of [].concat(g.dungeon)) if (!DUNGEONS[dg]) B.push(`${id} 地下城 ${dg}`);
        for (const k of [].concat(g.kind || [], g.from || [])) if (!MON[k]) B.push(`${id} 怪物 ${k}`);
        if ((g.type === 'collect' || g.type === 'item') && !ITEMS[g.key]) B.push(`${id} 道具 ${g.key}`);
        if (g.type === 'collect' && !ASSET_SRC['icon/' + ITEMS[g.key].icon]) B.push(`${id} 图标 ${ITEMS[g.key].icon}`);
        if (/undefined|null/.test(goalText(g))) B.push(`${id} 目标文字 ${goalText(g)}`);
      }
    }
    const jobs = Object.entries(CLASSES.fighter.jobs).map(([jid, J]) => ({ jid, n: J.quests.length, trial: J.trial === J.quests[J.quests.length - 1][0], first: QUESTS[J.quests[0][0]].pre.join(), aw: jobAwakenText('fighter', J) }));
    return { n: ids.length, B, jobs, lv: ['q_job_visit_fighter', 'q_job_fighter_final', 'q_awaken_fighter_1', 'q_awaken2_fighter_1', 'q_awaken3_fighter_1'].map(id => QUESTS[id].lvl), jobsOf: Object.keys(jobsOf('fighter') || {}) };
  });
  report(`格斗家任务 ${D.n} 个：NPC（都在场景里）/ 地下城 / 怪物 / 道具 / 图标 / 前置都存在，目标文字正常`, D.n >= 37 && !D.B.length, D.B.slice(0, 6));
  report('四个转职：任务线 3~4 步、trial = 最后一步、第一步接在「出师之战」后面', D.jobsOf.length === 4 && D.jobs.every(j => j.n >= 3 && j.trial && j.first === 'q_job_fighter_final'), D.jobs.map(j => `${j.jid}:${j.n}:${j.first}`));
  report('转职窗口的觉醒之路：一觉 21 / 二觉 26 / 三觉 30（名字来自 CLASSES.fighter.jobs）', D.jobs.every(j => /（Lv\.21）.*（Lv\.26）.*（Lv\.30）/.test(j.aw)) && D.lv.join() === '3,15,21,26,30', D.jobs.map(j => j.aw));
}

if (MODES.includes('chain')) {
  // 1) 入门：林纳斯 → 风振（真实 NPC 对话）
  await ev(() => { game.lvl = 3; save.data.questDone.q_job_kill = 1; });
  const v0 = await ev(() => ({ cls: game.player.cls, st: questState('q_job_visit_fighter'), others: ['sword', 'gun', 'mage'].map(c => questState(`q_job_visit_${c}`)), linus: questsOfNpc('linus') }));
  report('格斗家：林纳斯给出「风拳流大师风振」（别的职业的导师任务不出现）', v0.cls === 'fighter' && v0.st === 'avail' && v0.others.every(s => s === 'locked') && v0.linus.includes('q_job_visit_fighter'), v0);
  const acc = await npcQuest('linus', '风拳流大师风振', '接受');
  const done = await npcQuest('fengzhen', '风拳流大师风振', '完成任务'); if (done) { await page.click('.qreward .btn'); await wait(200); }
  report('在林纳斯处接受、在风振处交付（NPC 对话）', acc && done && await ev(() => questDone('q_job_visit_fighter')), { acc, done });
  // 2) 风拳流六式（第五式要先做完冰霜幽暗密林的隐藏任务）→ 出师之战（NPC 对话交付）→ 风振接着给出转职任务
  const steps = await ev(() => { game.lvl = 15; save.data.questDone.q_hidden_frozen = 1; const R = FQ.runAll([1, 2, 3, 4, 5, 6].map(i => `q_job_fighter_${i}`)); questAccept('q_job_fighter_final'); FQ.satisfy('q_job_fighter_final');
    return { ...R, names: [1, 6].map(i => QUESTS[`q_job_fighter_${i}`].name), fin: QUESTS.q_job_fighter_final.name, st: questState('q_job_fighter_final'), job0: jobAvailable(NPCS.fengzhen) }; });
  report('风拳流 第一式 ~ 第六式完成，出师之战达成（之前风振不显示转职）', steps.ok && steps.st === 'ready' && !steps.job0 && steps.names.join() === '风拳流 - 第一式,风拳流 - 第六式' && steps.fin === '风拳流 - 出师之战', steps);
  const fin = await npcQuest('fengzhen', '出师之战', '完成任务'); await page.click('.qreward .btn'); await wait(200);
  const nextQ = await ev(() => npcUI.qid);
  for (let i = 0; i < 6; i++) { const b = page.locator('.npcwin .qbtns .btn:has-text("接受")'); if (await b.count()) { await b.click(); break; } await page.click('.npcwin .qbtns .btn'); await wait(100); }
  const j0 = await ev(() => ({ fe: jobAvailable(NPCS.fengzhen), gsd: jobAvailable(NPCS.gsd), change: questState('q_job_fighter_change') }));
  report('交付出师之战 → 风振给出「拳脚的道路」，显示转职按钮（G.S.D 不显示）', fin && nextQ === 'q_job_fighter_change' && j0.fe && !j0.gsd && j0.change === 'active', { nextQ, ...j0 });
  await ev(() => { window.__snap = JSON.stringify({ quests: save.data.quests, questDone: save.data.questDone, flags: save.data.flags, track: save.data.questTrack }); });
  // 3) 转职窗口：4 个方向，接气功师的任务线
  await page.click('.npcmenu .btn:has-text("转职")'); await wait(500);
  const w0 = await ev(() => ({ open: menus.isOpen('job'), cards: document.querySelectorAll('.jobcard').length, lock: document.querySelectorAll('.jobcard.lock').length }));
  await page.click('.jobcard >> nth=0'); await wait(200);
  const label = await page.locator('.jobwin .btn.big').first().textContent();
  await page.click('.jobwin .btn:has-text("接受「气功师」")'); await wait(300);
  const p0 = await ev(() => ({ pick: save.data.jobPick, rec: !!questRec('q_job_nenmaster_1'), other: questState('q_job_striker_1') }));
  report('转职窗口 4 个方向（都要先做转职任务）→「接受「气功师」的转职任务」→ 第一步已接、别的方向不出现', w0.open && w0.cards === 4 && w0.lock === 4 && /接受「气功师」的转职任务/.test(label) && p0.pick === 'nenmaster' && p0.rec && p0.other === 'locked', { ...w0, label, ...p0 });
  await closeAll();
  // 换方向：进行中的那一步放弃，新方向第一步接上；再换回来
  const sw = await ev(() => { jobPickSet('fighter', 'striker'); const a = { pick: save.data.jobPick, n1: !!questRec('q_job_nenmaster_1'), s1: !!questRec('q_job_striker_1') }; jobPickSet('fighter', 'nenmaster'); return { a, back: { n1: !!questRec('q_job_nenmaster_1'), s1: !!questRec('q_job_striker_1') } }; });
  report('换方向：放弃进行中的一步、接上新方向第一步；换回来同理', sw.a.pick === 'striker' && !sw.a.n1 && sw.a.s1 && sw.back.n1 && !sw.back.s1, sw);
  const nl = await ev(() => { const L = CLASSES.fighter.jobs.nenmaster.quests.map(x => x[0]); const R = FQ.runAll(L); return { ...R, trialOk: jobTrialOk(CLASSES.fighter.jobs.nenmaster), strOk: jobTrialOk(CLASSES.fighter.jobs.striker) }; });
  report('气功师转职任务线 3 步完成 → 可以转成气功师（散打还不行）', nl.ok && nl.trialOk && !nl.strOk, nl);
  // 4) 回到风振处转职（转职窗口 → 二次确认 → 演出）
  await ev(() => openNpc(NPCS.fengzhen)); await wait(300);
  await page.click('.npcmenu .btn:has-text("转职")'); await wait(400);
  await page.click('.jobcard >> nth=0'); await wait(200);
  await page.click('.jobwin .btn:has-text("转职为「气功师」")'); await wait(200);
  await page.click('.jobask .btn:has-text("确定转职")'); await wait(1500);
  const jc = await ev(() => ({ job: game.job, saved: save.data.job, pick: save.data.jobPick || null, fx: !!document.querySelector('.jobfx'), change: questState('q_job_fighter_change') }));
  await wait(1800); if (await page.locator('.jobfx').count()) await page.click('.jobfx'); await wait(200); await closeAll();
  report('转职为气功师（窗口 → 确认 → 演出）、「拳脚的道路」可交付', jc.job === 'nenmaster' && jc.saved === 'nenmaster' && !jc.pick && jc.fx && jc.change === 'ready', jc);
  // 5) 觉醒：一觉（通用第一步 → 本转职剧情两步 → 通用第二步）→ 二觉 → 三觉
  const awk = jid => ev(jid => {
    const out = {};
    out.change = FQ.run('q_job_fighter_change').ok;
    game.lvl = 21; save.data.questDone.q_hidden_dark = 1;
    out.a1 = FQ.run('q_awaken_fighter_1').ok;
    const mid = Object.keys(QUESTS).filter(id => new RegExp(`^q_awaken_${jid}_\\d$`).test(id));
    out.gate = { a2: questState('q_awaken_fighter_2'), mine: questState(mid[0]), others: ['nenmaster', 'striker', 'brawler', 'grappler'].filter(j => j !== jid).map(j => questState(`q_awaken_${j}_1`)) };
    out.mid = FQ.runAll(mid); out.midN = mid.length;
    out.a2avail = questState('q_awaken_fighter_2');
    out.a2 = FQ.run('q_awaken_fighter_2').ok; out.f1 = !!save.data.flags.awaken && tierUnlocked(1);
    game.lvl = 26; out.b = FQ.runAll(['q_awaken2_fighter_1', 'q_awaken2_fighter_2']).ok; out.f2 = tierUnlocked(2);
    game.lvl = 30; out.c = FQ.runAll(['q_awaken3_fighter_1', 'q_awaken3_fighter_2']).ok; out.f3 = tierUnlocked(3);
    out.names = [QUESTS[mid[0]].name, QUESTS.q_awaken_fighter_2.name];
    return out;
  }, jid);
  const a0 = await awk('nenmaster');
  const awOk = a => a.change && a.a1 && a.gate.a2 === 'locked' && a.gate.mine === 'avail' && a.gate.others.every(s => s === 'locked') && a.mid.ok && a.midN === 2 && a.a2avail === 'avail' && a.a2 && a.f1 && a.b && a.f2 && a.c && a.f3;
  report('气功师：一觉剧情做完才出现「觉醒 - 破壁」→ 一 / 二 / 三觉解锁（别的转职的一觉剧情不出现）', awOk(a0), a0);
  // 6) 另外三个转职：回到出师之战刚交付的存档状态，用接口各走一遍
  for (const jid of ['striker', 'brawler', 'grappler']) {
    const r = await ev(jid => {
      const S = JSON.parse(window.__snap), d = save.data;
      Object.assign(d, { quests: S.quests, questDone: S.questDone, flags: S.flags, questTrack: S.track, job: null }); delete d.jobPick; game.job = null; game.lvl = 15; questDirty();
      const J = CLASSES.fighter.jobs[jid], L = J.quests.map(x => x[0]), before = jobTrialOk(J);
      jobPickSet('fighter', jid);
      const first = !!questRec(L[0]), line = FQ.runAll(L), after = jobTrialOk(J), changed = doJobChange(jid);
      return { name: J.name, before, first, line, after, changed, job: game.job, n: L.length };
    }, jid);
    report(`${r.name}：接任务线 → ${r.n} 步完成 → 转职`, !r.before && r.first && r.line.ok && r.after && r.changed && r.job === jid, r);
    const a = await awk(jid);
    report(`${r.name}：一觉剧情 → 一 / 二 / 三觉`, awOk(a), a);
  }
  await ev(() => save.write());
}

const errs = logs.filter(l => l.type === 'pageerror' || l.type === 'error'); report('无报错', errs.length === 0, errs.slice(0, 3));
await browser.close();
console.log(fail ? `${fail} 项失败` : '全部通过');
process.exit(fail ? 1 : 0);
