// 任务与转职测试：
//   1. 接取 → 事件推进（真实地下城 + 事件）→ 交付 → 奖励到账 → 刷新后进度仍在
//   2. 击杀 / 收集 / 试炼（被击次数）/ 对话 / 上交物品
//   3. 每日任务 06:00 重置
//   4. 两个隐藏地下城的门在任务完成后出现在区域地图上
//   5. 用假的 jobs 表完整走一遍转职（按钮 → 窗口 → 二次确认 → 演出 → game.job / 事件 / onJobChange / 存档）+ 觉醒标记
//   6. 任务日志（F1）、追踪栏、NPC 头顶标记
// 截图在 test/shots/quests/
import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';
const out = 'test/shots/quests'; fs.mkdirSync(out, { recursive: true });
const { browser, page, logs } = await launch({ width: 1600, height: 900 });
const wait = ms => page.waitForTimeout(ms), shot = n => page.screenshot({ path: `${out}/${n}.png` });
const ev = (fn, arg) => page.evaluate(fn, arg);
let fails = 0;
const check = (ok, msg, extra = '') => { console.log(`${ok ? '  ✔' : '  ✘'} ${msg}${extra ? '  ' + extra : ''}`); if (!ok) fails++; };
const step = s => console.log('·', s);
const closeAll = () => ev(() => { while (menus.stack.length) menus.close(menus.stack[menus.stack.length - 1]); });
const Q = id => ev(id => ({ st: questState(id), rec: save.data.quests[id] || null, done: !!save.data.questDone[id] }), id);
// NPC 对话：点任务 → 一直“下一页” → 点指定按钮
async function npcQuest(npc, qname, btn) {
  await ev(id => { const S = sceneOfNpc(id); if (S && world.S.id !== S.id) return enterScene(S.id); }, npc); await wait(400);
  await ev(id => { const e = world.npcs.find(x => x.npc.id === id); if (e) { game.player.x = e.x - 40; game.player.y = e.y; } }, npc); await wait(150);
  await page.keyboard.press('KeyX'); await wait(400);
  if (!await ev(() => menus.isOpen('npc'))) await ev(id => openNpc(NPCS[id]), npc), await wait(300);
  await page.click(`.npcmenu .qitem:has-text("${qname}")`); await wait(200);
  for (let i = 0; i < 12; i++) {
    const b = page.locator(`.npcwin .qbtns .btn:has-text("${btn}")`);
    if (await b.count()) { await b.first().click(); await wait(300); return true; }
    await page.click('.npcwin .qbtns .btn'); await wait(120);
  }
  return false;
}

await page.goto(`${URL_BASE}?town&cls=sword&mute&notype`);
await page.waitForFunction(() => window.__READY, null, { timeout: 30000 }); await wait(600); await closeAll();

step('任务数量');
const cnt = await ev(() => Object.values(QUESTS).reduce((m, q) => (m[q.type] = (m[q.type] || 0) + 1, m), {}));
check(cnt.main >= 15, `主线 ${cnt.main} 个（≥15）`); check(cnt.side >= 15, `支线 ${cnt.side} 个（≥15）`); check(cnt.daily >= 3 && cnt.daily <= 5, `每日 ${cnt.daily} 个（3~5）`); check(cnt.job >= 3, `转职 ${cnt.job} 个`); check(cnt.hidden >= 2, `隐藏 ${cnt.hidden} 个`);
const bad = await ev(() => { const B = []; for (const q of Object.values(QUESTS)) { for (const p of q.pre) if (!QUESTS[p]) B.push(`${q.id} 前置 ${p} 不存在`); for (const g of q.goals) { if (g.dungeon && g.dungeon !== 'any') for (const d of [].concat(g.dungeon)) if (!DUNGEONS[d]) B.push(`${q.id} 地下城 ${d}`); for (const k of [].concat(g.kind || [], g.from || [])) if (!MON[k]) B.push(`${q.id} 怪物 ${k}`); if (g.type === 'reach' && !SCENES[g.scene]) B.push(`${q.id} 场景 ${g.scene}`); } } return B; });
check(bad.length === 0, '任务数据引用的地下城 / 怪物 / 场景 / 前置都存在', bad.slice(0, 5).join('；'));

step('1. 接取 → 交付（赛丽亚 → 林纳斯）');
check(await ev(() => questMarker('seria')) === '!', '赛丽亚头顶是黄色 !（可接）');
await shot('01-town-marker');
check(await npcQuest('seria', '铁匠林纳斯', '接受'), '在赛丽亚的对话窗口里接受「铁匠林纳斯」');
check((await Q('q_m01')).st === 'ready', '「铁匠林纳斯」没有目标 → 直接可交付');
const mk = await ev(() => ({ linus: questMarkerInfo('linus'), seria: questMarker('seria') }));
check(mk.linus && mk.linus.ch === '?' && mk.linus.col === '#ffd23a', '林纳斯头顶变成黄色 ?（可交付）');
await closeAll();
const g0 = await ev(() => ({ gold: game.gold, hpS: inv.count('hpS'), exp: game.exp, lvl: game.lvl }));
check(await npcQuest('linus', '铁匠林纳斯', '完成任务'), '在林纳斯处点「完成任务」');
const g1 = await ev(() => ({ gold: game.gold, hpS: inv.count('hpS'), exp: game.exp, lvl: game.lvl, pop: menus.isOpen('npcquest'), next: npcUI.qid, mode: npcUI.mode }));
const rw1 = await ev(() => QUESTS.q_m01.reward);
check(g1.gold - g0.gold === rw1.gold, `金币 +${rw1.gold}（${g0.gold} → ${g1.gold}）`); check(g1.hpS - g0.hpS === 5, '小型生命药剂 +5');
check(g1.exp > g0.exp || g1.lvl > g0.lvl, '经验到账'); check(g1.pop, '弹出任务完成奖励窗口');
check(g1.next === 'q_m02' && g1.mode === 'offer', '交付后林纳斯接着说下一个主线「开始冒险」');
await wait(500); await shot('02-reward-popup');
await page.click('.qreward .btn'); await wait(200);
for (let i = 0; i < 8; i++) { const b = page.locator('.npcwin .qbtns .btn:has-text("接受")'); if (await b.count()) { await b.click(); break; } await page.click('.npcwin .qbtns .btn'); await wait(100); }
check((await Q('q_m02')).st === 'active', '接受「开始冒险」（通关洛兰）');
await closeAll();

step('2. 真实地下城：机器人通关洛兰，任务进度靠 bus 事件推进');
await ev(() => { defineQuest('t_skill', { name: '测试：用技能', goals: [{ type: 'skill', n: 3 }] }); defineQuest('t_kill', { name: '测试：洛兰击杀', goals: [{ type: 'kill', dungeon: 'lorien', n: 5 }] }); questAccept('t_skill'); questAccept('t_kill'); });
await ev(() => enterDungeon('lorien', 0)); await wait(2500);
await ev(() => { bot.on = true; game.speedMul = 3; }); await wait(4000); await shot('03-dungeon-tracker');
await page.waitForFunction(() => window.__botDone, null, { timeout: 240000, polling: 1000 });
await ev(() => { bot.on = false; game.speedMul = 1; });
const d2 = await ev(() => ({ m02: questState('q_m02'), sk: save.data.quests.t_skill && save.data.quests.t_skill.p[0], kill: save.data.quests.t_kill && save.data.quests.t_kill.p[0], r: window.__botDone }));
check(d2.m02 === 'ready', '通关洛兰后「开始冒险」可交付', JSON.stringify(d2.r));
check(d2.kill === 5, `真实击杀推进击杀目标（${d2.kill}/5）`);
check(d2.sk === 3, `真实施放技能推进技能目标（${d2.sk}/3）`);
await page.click('text=返回城镇'); await wait(1500);
await ev(() => { questAbandon('t_skill'); questAbandon('t_kill'); delete QUESTS.t_skill; delete QUESTS.t_kill; });

step('3. 刷新后进度仍在');
await ev(() => save.write());
await page.reload(); await page.waitForFunction(() => window.__READY, null, { timeout: 30000 }); await wait(600); await closeAll();
const r1 = await ev(() => ({ m01: !!save.data.questDone.q_m01, m02: questState('q_m02'), p: save.data.quests.q_m02 && save.data.quests.q_m02.p }));
check(r1.m01 && r1.m02 === 'ready' && r1.p[0] === 1, '刷新后：q_m01 已完成、q_m02 仍可交付', JSON.stringify(r1));
const w0 = await ev(() => inv.items.filter(i => i.kind === 'equip').length);
check(await npcQuest('linus', '开始冒险', '完成任务'), '交付「开始冒险」');
check(await ev(() => inv.items.filter(i => i.kind === 'equip').length) === w0 + 1, '奖励武器进了背包');
await closeAll();

step('4. 击杀 / 收集 / 试炼 / 对话 / 上交物品（事件驱动）');
await ev(() => { game.lvl = Math.max(game.lvl, 2); questAccept('q_m03'); });
await ev(() => { for (let i = 0; i < 5; i++) bus.emit('kill', { kind: 'goblin', dungeon: 'lorien', lvl: 2, x: 400, y: 80 }); });
check((await Q('q_m03')).rec.p[0] === 0, '在别的地下城击杀不计数');
await ev(() => { for (let i = 0; i < 12; i++) bus.emit('kill', { kind: i % 2 ? 'goblin' : 'goblinThrower', dungeon: 'lorien_deep', lvl: 2, x: 400, y: 80 }); });
check((await Q('q_m03')).st === 'ready', '洛兰深处击杀 12 只哥布林 → 可交付');
check(await ev(() => questMarkerInfo('linus').col) === '#ffd23a', '林纳斯头顶黄色 ?');
await ev(() => questAccept('q_job_kill'));
await ev(() => bus.emit('dungeonClear', { id: 'lorien_deep', diff: 0, rank: 'A', time: 90, hurt: 20 }));
check((await Q('q_job_kill')).rec.p[0] === 0, '试炼：被击 20 次（要求 ≤12）不算');
await ev(() => bus.emit('dungeonClear', { id: 'lorien_deep', diff: 0, rank: 'A', time: 90, hurt: 8 }));
check((await Q('q_job_kill')).st === 'ready', '试炼：被击 8 次 → 达成');
await ev(() => { for (const id of ['q_m03', 'q_m04', 'q_m05', 'q_m06', 'q_m07', 'q_m08', 'q_m09', 'q_m10', 'q_m11']) save.data.questDone[id] = 1; delete save.data.quests.q_m03; game.lvl = 8; questAccept('q_m12'); });
await ev(() => bus.emit('kill', { kind: 'catKing', boss: true, dungeon: 'venom_ruins', lvl: 12, x: 500, y: 90 }));
check((await Q('q_m12')).st === 'ready', '收集：毒猫王掉落「毒猫王的毒药袋」→ 可交付');
check(await ev(() => questMarkerInfo('gsd') && questMarkerInfo('gsd').ch) === '?', 'G.S.D 头顶 ?（可交付）');
// 对话目标：艾丽丝的「冰与火的歌谣」第一个目标是和莎兰对话
await ev(() => { game.lvl = 13; save.data.questDone.q_m12 = 1; delete save.data.quests.q_m12; questAccept('s_alice_song'); });
check(await ev(() => questMarker('sharan')) === '?', '有“与莎兰对话”目标时莎兰头顶是 ?');
await ev(() => openNpc(NPCS.sharan)); await wait(300);
const talk = await ev(() => ({ p: save.data.quests.s_alice_song.p[0], mode: npcUI.mode, line: document.querySelector('.npcwin .qline').textContent }));
check(talk.p === 1 && talk.mode === 'talk', '和莎兰对话 → 对话目标完成，窗口播放任务台词', talk.line.slice(0, 30));
await shot('04-talk-goal'); await closeAll();
// 上交物品
await ev(() => { save.data.questDone.s_sherlock_trust = 1; game.lvl = 9; questAccept('s_sherlock_biz'); });
const it0 = await ev(() => inv.count('hpS'));
await ev(() => inv.add(makeConsumable('hpS', 10)));
check((await Q('s_sherlock_biz')).st === 'ready', '背包里有 10 瓶小型生命药剂 → 可交付');
await ev(() => questComplete('s_sherlock_biz'));
check(await ev(() => inv.count('hpS')) === it0, '交付时扣掉 10 瓶药剂');

step('5. 每日任务 06:00 重置');
await ev(() => { game.lvl = Math.max(game.lvl, 10); questAccept('d_seria_help'); bus.emit('dungeonClear', { id: 'lorien', diff: 0, rank: 'B', time: 60, hurt: 3 }); bus.emit('dungeonClear', { id: 'graca', diff: 0, rank: 'C', time: 60, hurt: 3 }); });
check((await Q('d_seria_help')).st === 'ready', '每日：通关任意地下城 2 次 → 可交付');
await ev(() => { questComplete('d_seria_help'); questAccept('d_beer'); });
check((await Q('d_seria_help')).st === 'done', '每日任务今天已完成，不能再接');
await ev(() => { save.data.day = '2000-1-1'; save.daily(); });
const dr = await ev(() => ({ a: questState('d_seria_help'), b: questState('d_beer'), m: !!save.data.questDone.q_m01 }));
check(dr.a === 'avail' && dr.b === 'avail', '跨过 06:00 后每日任务重置为可接（进行中的也清空）', JSON.stringify(dr));
check(dr.m, '主线的完成记录不受每日重置影响');

step('6. 隐藏地下城：任务完成后门出现在区域地图上');
for (const [qid, dg, setup] of [
  ['q_hidden_frozen', 'frozen_woods', () => { game.lvl = 9; save.data.questDone.q_m12 = 1; questAccept('q_hidden_frozen'); const r = Math.random; Math.random = () => 0; for (let i = 0; i < 5; i++) bus.emit('kill', { kind: 'goblinFrost', dungeon: 'thunder_ruins', lvl: 9 }); Math.random = r; }],
  ['q_hidden_dark', 'dark_thunder', () => { game.lvl = 15; for (const id of ['q_m13', 'q_m14', 'q_m15', 'q_m16', 'q_m17', 'q_m18']) save.data.questDone[id] = 1; questAccept('q_dark_1'); questComplete('q_dark_1'); questAccept('q_dark_2'); const r = Math.random; Math.random = () => 0; for (let i = 0; i < 8; i++) bus.emit('kill', { kind: 'catVenom', dungeon: 'venom_ruins', lvl: 10 }); Math.random = r; questComplete('q_dark_2'); questAccept('q_hidden_dark'); bus.emit('dungeonClear', { id: 'thunder_ruins', diff: 0, rank: 'S', time: 100, hurt: 4 }); }],
]) {
  const sc = await ev(dg => Object.values(SCENES).find(s => s.gates.some(g => g.dungeon === dg)).id, dg);
  await ev(sc => enterScene(sc), sc); await wait(700);
  check(await ev(dg => !gateVisible(world.S.gates.find(g => g.dungeon === dg)), dg), `${dg}：任务完成前门不可见（${sc}）`);
  await ev(setup);
  check((await Q(qid)).st === 'ready', `${qid} 目标达成`);
  await ev(id => questComplete(id), qid);
  check(await ev(dg => gateVisible(world.S.gates.find(g => g.dungeon === dg)) && dungeonUnlocked(DUNGEONS[dg]), dg), `${dg}：完成 ${qid} 后门出现`);
  await ev(dg => { const g = world.S.gates.find(g => g.dungeon === dg); game.player.x = g.x + 90; game.player.y = 60; }, dg); await wait(600);
  await closeAll(); await wait(300); await shot(`05-gate-${dg}`);
}

step('7. 转职（假 jobs 表）');
await ev(() => {
  CLASSES.sword.jobs = {
    blade: { name: '剑魂', role: '近战 · 连击', desc: '专精各类武器的剑术大师，连段华丽、浮空控制出色。', skills: ['iai', 'rise', 'flurry', 'awaken'], awaken: 'awaken', awakenName: '极·鬼剑术' },
    berserker: { name: '狂战士', role: '近战 · 爆发', desc: '以自身鲜血为代价换取狂暴力量的战士，越战越勇。', skills: ['slam', 'spin', 'focus'], awaken: 'awaken', awakenName: '魔狱血刹' },
  };
  window.onJobChange = (p, job) => { window.__ojc = job; recalcStats(p); };
  bus.on('jobChange', e => { window.__jce = e.job; });
  game.lvl = 15; for (const id of ['q_job_kill', 'q_job_visit_sword', 'q_job_sword_1', 'q_job_sword_2', 'q_job_sword_3', 'q_job_sword_4', 'q_job_sword_5', 'q_job_sword_6']) save.data.questDone[id] = 1;
  save.data.questDone.q_job_kill = 1; delete save.data.quests.q_job_kill;
});
check(await ev(() => !jobAvailable(NPCS.gsd)), '试炼没完成时 G.S.D 不显示转职');
await ev(() => { questAccept('q_job_sword_final'); bus.emit('dungeonClear', { id: 'blazing_graca', diff: 0, rank: 'A', time: 200, hurt: 11 }); });
check((await Q('q_job_sword_final')).st === 'ready', '最后的修炼：被击 11 次通关烈焰格拉卡 → 达成');
check(await npcQuest('gsd', '最后的修炼', '完成任务'), '交付最后的修炼');
await page.click('.qreward .btn'); await wait(200);
check(await ev(() => npcUI.qid) === 'q_job_sword_change', 'G.S.D 接着给出转职任务');
for (let i = 0; i < 6; i++) { const b = page.locator('.npcwin .qbtns .btn:has-text("接受")'); if (await b.count()) { await b.click(); break; } await page.click('.npcwin .qbtns .btn'); await wait(100); }
check(await ev(() => jobAvailable(NPCS.gsd) && !jobAvailable(NPCS.kiri)), 'Lv.15 + 试炼完成：G.S.D 显示转职（凯丽不显示）');
await shot('06-npc-job-button');
await page.click('.npcmenu .btn:has-text("转职")'); await wait(500);
check(await ev(() => menus.isOpen('job')), '打开转职窗口');
await shot('07-job-window');
await page.click('.jobcard >> nth=0'); await wait(200);
await page.click('.jobwin .btn:has-text("转职为")'); await wait(200);
await shot('08-job-confirm');
check(await ev(() => !game.job), '二次确认前不会转职');
await page.click('.jobask .btn:has-text("确定转职")'); await wait(1200);
await shot('09a-job-ceremony-flash');
const j1 = await ev(() => ({ job: game.job, saved: save.data.job, jce: window.__jce, ojc: window.__ojc, fx: !!document.querySelector('.jobfx') }));
check(j1.job === 'blade' && j1.saved === 'blade', '转职为剑魂（game.job / save.data.job）', JSON.stringify(j1));
check(j1.jce === 'blade', 'bus 发出 jobChange'); check(j1.ojc === 'blade', '调用了 onJobChange(p, job)'); check(j1.fx, '播放转职演出');
await wait(2200); await shot('09b-job-ceremony'); await wait(400); await page.click('.jobfx'); await wait(300);
check(await ev(() => !document.querySelector('.jobfx')), '点击关闭演出');
check((await Q('q_job_sword_change')).st === 'ready', '转职任务「鬼神的指引」目标达成');
check(await ev(() => !jobAvailable(NPCS.gsd)), '转职后不再显示转职按钮');
await ev(() => questComplete('q_job_sword_change')); await closeAll();
await ev(() => save.write());
await page.reload(); await page.waitForFunction(() => window.__READY, null, { timeout: 30000 }); await wait(600); await closeAll();
check(await ev(() => game.job) === 'blade', '刷新后转职仍在');

step('8. 觉醒任务 → awakenUnlocked()');
await ev(() => { game.lvl = 18; questAccept('q_awaken_sword_1'); for (let i = 0; i < 3; i++) bus.emit('dungeonClear', { id: 'dark_thunder', diff: 0, rank: 'B', time: 200, hurt: 10 }); questComplete('q_awaken_sword_1'); questAccept('q_awaken_sword_2'); });
check(await ev(() => !awakenUnlocked()), '觉醒任务完成前 awakenUnlocked() = false');
const cr0 = await ev(() => { inv.add(makeConsumable('crystal', 30)); bus.emit('dungeonClear', { id: 'blazing_graca', diff: 2, rank: 'S', time: 150, hurt: 5 }); return inv.count('crystal'); });
check((await Q('q_awaken_sword_2')).st === 'ready', '勇士级 S 评价 + 30 个无色小晶块 → 可交付');
await ev(() => questComplete('q_awaken_sword_2'));
check(await ev(() => awakenUnlocked() && save.data.flags.awaken === true), '觉醒任务完成 → awakenUnlocked() = true');
check(await ev(() => inv.count('crystal')) === cr0 - 30, '交付时扣掉 30 个无色小晶块');

step('9. 任务日志（F1）与追踪栏');
await ev(() => { questAccept('s_grandis_rest'); questAccept('s_skadi_border'); for (let i = 0; i < 7; i++) bus.emit('kill', { kind: 'zombie', dungeon: 'dark_thunder' }); });
await ev(() => enterScene('hendon_myre')); await wait(900); await closeAll();
await shot('10-town-tracker');
await page.keyboard.press('F1'); await wait(400);
check(await ev(() => menus.isOpen('quests')), 'F1 打开任务日志');
await page.click('.qtab:has-text("支线")'); await wait(200);
await page.click('.qli:has-text("安息的祈祷")'); await wait(200);
await shot('11-quest-log');
await page.click('.qdet .btn:has-text("放弃任务")'); await wait(150);
await page.click('.qdet .btn.red:has-text("放弃")'); await wait(200);
check(await ev(() => !save.data.quests.s_grandis_rest && questState('s_grandis_rest') === 'avail'), '在任务日志里放弃任务 → 回到可接');
await page.click('.qtab:has-text("转职")'); await wait(200); await shot('12-quest-log-job');
await closeAll();
await page.keyboard.press('KeyL'); await wait(300);
check(await ev(() => menus.isOpen('quests')), 'L 也能打开任务日志');
await closeAll();

step('10. NPC 头顶标记（模拟世界组在 world.js 里调用 drawQuestMarker 的钩子）');
await ev(() => {
  // 赛丽亚：可接主线（金色大 !）；林纳斯：进行中（灰色 ?）；设置好状态后在 world.js 名牌同样的位置画标记
  // 测试用 NPC：只有一个进行中的任务 → 灰色 ?
  defineNpc('t_npc', { name: '测试员', art: 'world/npc_paris', h: 114 }); defineQuest('t_grey', { name: '测试：进行中', npc: 't_npc', goals: [{ type: 'kill', n: 99 }] }); questAccept('t_grey');
  SCENES.elvenguard.npcs.push({ npc: 't_npc', x: 1700, y: 44 });
  const orig = renderScene; window.__mkDrawn = 0;
  renderScene = function (c) { orig(c); for (const e of world.npcs) { const N = e.npc; if (drawQuestMarker(c, sx(e.x), sy(e.y, N.h + 16) - 24, N.id)) window.__mkDrawn++; } };
  window.questMarker = () => null;   // 关掉 world.js 旧的文字标记，只看新钩子
  return enterScene('elvenguard');
});
await wait(900); await closeAll(); await wait(200);
const mk2 = await ev(() => ({ grey: questMarkerInfo('t_npc'), linus: questMarkerInfo('linus'), drawn: window.__mkDrawn }));
check(mk2.drawn > 0, `drawQuestMarker 能正常绘制（${mk2.drawn} 次）`);
check(mk2.grey && mk2.grey.ch === '?' && mk2.grey.col === '#9a9a9a', '只有进行中任务的 NPC → 灰色 ?', JSON.stringify(mk2.grey));
check(mk2.linus && mk2.linus.ch === '!' && mk2.linus.main, '有可接主线的林纳斯 → 金色 !（主线加大光芒）', JSON.stringify(mk2.linus));
await ev(() => { game.player.x = 1260; }); await wait(600);
await shot('13-npc-markers');
const clickRect = await ev(() => questUI.trackRect);
check(!!clickRect, '追踪栏记录了点击区域');
if (clickRect) { const box = await page.locator('#world').boundingBox(); await page.mouse.click(box.x + (clickRect.x + clickRect.w / 2) / 1920 * box.width, box.y + (clickRect.y + 20) / 1080 * box.height); await wait(300); check(await ev(() => menus.isOpen('quests')), '点击追踪栏打开任务日志'); await closeAll(); }

console.log('LOGS', JSON.stringify(logs.filter(l => l.type !== 'warning'), null, 1));
check(logs.filter(l => l.type === 'pageerror' || (l.type === 'error' && !/Failed to load resource/.test(l.text))).length === 0, '没有页面错误');
await browser.close();
console.log(fails ? `\n失败 ${fails} 项` : '\n全部通过');
process.exit(fails ? 1 : 0);
