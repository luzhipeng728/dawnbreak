// 真实试玩：像玩家一样用键盘 / 鼠标从头玩（kbplay.mjs），每一步截图，记录发现的问题
// 用法：node test/playthrough.mjs <路线> [职业序号 0/1/2]
//   newbie：标题 → 创建角色 → 赛丽亚 → 林纳斯 → 洛兰 → 通关翻牌 → 回门口 → 回城交任务 → 商店 / 强化 / 装备 / 技能 / 地图
import { launch, URL_BASE } from './lib.mjs';
import { kbPlayer } from './kbplay.mjs';
const leg = process.argv[2] || 'newbie', ci = +(process.argv[3] || 0);
const CLS = ['sword', 'gun', 'mage'][ci];
const out = `test/shots/playthrough/${leg}-${CLS}`;
const { browser, page, logs } = await launch({ width: 1280, height: 720 });
const P = kbPlayer(page, { out });
const wait = P.wait, step = s => console.log('·', s);
const toasts = () => page.evaluate(() => toastList.map(m => m.msg));
const errs = () => logs.filter(l => l.type === 'pageerror' || l.type === 'error');
let fail = 0;
const check = (ok, msg) => { if (!ok) { fail++; P.note(msg); } };

async function newbie() {
  await page.goto(`${URL_BASE}?mute&fresh`);
  await page.waitForFunction(() => window.__READY); await wait(800);
  await P.shot('title');
  await page.click('text=进入游戏'); await wait(500); await P.shot('charselect');
  await page.click('#charsel button:has-text("创建角色")'); await wait(500);
  await page.click(`.clscard >> nth=${ci}`); await wait(300);
  await page.fill('#newgame input.txt', ['晨星剑客', '夜枪', '小法师'][ci]); await P.shot('newgame');
  await page.click('text=创建并开始'); await wait(1500);
  await P.shot('help');
  if (await page.evaluate(() => menus.isOpen('help'))) await P.tap('Escape');
  await wait(400); await P.shot('seria-room');
  step('出生：' + await page.evaluate(() => world.S.id) + ' 提示：' + JSON.stringify(await toasts()));
  // 和赛丽亚对话，接主线
  check(await P.talk('seria'), '和赛丽亚对话失败');
  await P.shot('seria-talk');
  // 真实玩家：先按 X 看看会不会进入任务；不行就点右侧的任务
  await P.tap('KeyX'); await wait(300); await P.tap('KeyX'); await wait(300);
  let b = await page.evaluate(() => npcUI.mode);
  if (b === 'greet') { P.note('和赛丽亚对话：只显示寒暄，按 X 不会进入主线任务，需要点右侧任务列表'); await P.pickQuest('铁匠林纳斯'); }
  b = await P.dialogTo(['接受']); step('赛丽亚：' + b); await P.shot('seria-accept');
  await P.tap('KeyX'); await wait(300); await P.closeAll();
  // 出门
  check(await P.exitTo('elvenguard'), '出不了赛丽亚的房间');
  await P.shot('elvenguard');
  check(await P.talk('linus'), '和林纳斯对话失败'); await P.shot('linus-talk');
  if (await page.evaluate(() => npcUI.mode) === 'greet') { P.note('林纳斯：对话打开是寒暄，要交的任务需要手动点'); await P.pickQuest('铁匠林纳斯'); }
  const b2 = await P.dialogTo(['完成任务']); step('林纳斯交任务：' + b2); await wait(500); await P.shot('linus-done');
  // 奖励窗口
  if (await page.evaluate(() => menus.isOpen('npcquest'))) { await P.tap('KeyX'); await wait(400); }
  const b3 = await P.dialogTo(['接受']); step('林纳斯接任务：' + b3); await P.shot('linus-accept');
  await P.closeAll(); await wait(300);
  await P.shot('after-linus');
  step('任务：' + JSON.stringify(await page.evaluate(() => Object.keys(save.data.quests))));
  // 出城 → 洛兰
  const route = await page.evaluate(() => world.S.exits.map(e => `${e.side}:${e.to}`));
  step('艾尔文防线出口：' + route.join(' '));
  check(await P.exitTo('gf_lorien'), '走不到洛兰');
  await P.shot('lorien-field');
  check(await P.toGate('lorien'), '走到洛兰门口没弹出选择窗口');
  await P.shot('gate');
  await P.enterDungeon(); await P.shot('dungeon-enter');
  let rooms = 0;
  const r = await P.fightDungeon({ onRoom: async () => { rooms++; if (rooms <= 3) await P.shot(`room${rooms}`); } });
  step('通关：' + JSON.stringify(r));
  await P.shot('clear');
  await P.flipAndReturn(); await P.shot('back-gate');
  step('回到：' + await page.evaluate(() => `${world.S.id} x=${Math.round(game.player.x)}`) + ' Lv.' + await page.evaluate(() => game.lvl));
  // 回城交任务：从洛兰往左回艾尔文防线
  check(await P.exitTo('elvenguard'), '回不到艾尔文防线'); await P.shot('back-town');
  check(await P.talk('linus'), '回城和林纳斯对话失败');
  if (await page.evaluate(() => npcUI.mode) === 'greet') await P.pickQuest('开始冒险');
  const b4 = await P.dialogTo(['完成任务']); step('交任务：' + b4); await wait(400); await P.shot('turn-in');
  if (await page.evaluate(() => menus.isOpen('npcquest'))) { await P.tap('KeyX'); await wait(400); }
  const b5 = await P.dialogTo(['接受']); step('下一个任务：' + b5);
  await P.closeAll();
}

async function clickDlgOk() { const b = page.locator('.idlg .row .btn').last(); if (await b.count()) { await b.click(); await wait(400); return true; } return false; }
async function town() {
  // 商店：林纳斯（多选购买 → 出售）
  check(await P.talk('linus'), '和林纳斯对话失败');
  const svc = await page.evaluate(() => [...menus.wins.npc.querySelectorAll('.npcmenu .btn')].map(b => b.textContent));
  step('林纳斯菜单：' + svc.join(' '));
  await P.npcService('商店'); await P.shot('shop');
  const g0 = await page.evaluate(() => ({ gold: game.gold, n: inv.items.length }));
  await page.click('.shopcats .cat:has-text("材料")').catch(() => {}); await wait(200);
  const rows = page.locator('.shopwin .srow'); const nRows = await rows.count();
  for (let i = 0; i < Math.min(2, nRows); i++) { await rows.nth(i).click(); await wait(150); }
  await P.shot('shop-select');
  await page.click('.shopwin .btn:has-text("购买选中")'); await wait(300); await clickDlgOk();
  const g1 = await page.evaluate(() => ({ gold: game.gold, n: inv.items.length }));
  step(`多选购买：金币 ${g0.gold} → ${g1.gold}，物品 ${g0.n} → ${g1.n}`); check(g1.gold < g0.gold, '多选购买没有扣钱');
  await P.shot('shop-bought');
  await page.click('.shopwin .itab:has-text("出售")'); await wait(250);
  await page.click('.shopwin .cat:has-text("全选普通")'); await wait(200); await P.shot('sell-select');
  const sellBtn = page.locator('.shopwin .btn:has-text("出售选中")');
  if (await sellBtn.count()) { await sellBtn.click(); await wait(300); await clickDlgOk(); }
  const g2 = await page.evaluate(() => ({ gold: game.gold, n: inv.items.length }));
  step(`出售：金币 ${g1.gold} → ${g2.gold}，物品 ${g1.n} → ${g2.n}`); await P.shot('sold');
  await P.closeAll();
  // 背包：右键穿装备（先从回购把装备买回来一件，保证有装备可穿——正常玩家不会全卖，这里只是为了继续流程）
  await P.tap('KeyI'); await wait(400);
  const eqCell = page.locator('[data-win="inv"] .igrid .islot:has(img)').first();
  if (await eqCell.count()) { await eqCell.click({ button: 'right' }); await wait(300); step('右键穿戴：' + await page.evaluate(() => Object.keys(inv.equip).filter(k => inv.equip[k]).join(','))); }
  else P.note('背包里没有装备可穿（都卖掉了）');
  await P.tap('KeyM'); await wait(400); await P.shot('inv-status');
  await P.closeAll();
  // 强化
  check(await P.talk('linus'), '和林纳斯对话失败');
  await P.npcService('强化'); await wait(300); await P.shot('enhance');
  const eb = page.locator('.enhright .btn.big');
  if (await eb.count()) { const e0 = await page.evaluate(() => IW.enhSel && IW.enhSel.enh); await eb.click(); await wait(400); await clickDlgOk(); await wait(1500); const e1 = await page.evaluate(() => IW.enhMsg && IW.enhMsg.text); step(`强化：+${e0} → ${e1}`); await P.shot('enhanced'); }
  await P.closeAll();
  // 技能：学一个技能，拖到 HUD 技能栏
  await P.tap('KeyK'); await wait(400);
  const learn = page.locator('.sklist2 .ski2:not(.lock) .pmb:not(.off):has-text("+")').first();
  if (await learn.count()) { await learn.click(); await wait(300); }
  await P.shot('skills');
  const learned = await page.evaluate(() => Object.keys(game.skillLv).filter(k => game.skillLv[k] > 0 && !SKILLS[k].passive).sort((a, b) => game.skillBar.includes(a) - game.skillBar.includes(b)));
  step('已学的主动技能：' + learned.join(','));
  if (learned.length) {
    const target = await page.evaluate(() => { const R = hudSkillRect(4), r = ucan.getBoundingClientRect(); return { x: r.left + (R.x + R.s / 2) / 1920 * r.width, y: r.top + (R.y + R.s / 2) / 1080 * r.height }; });
    const b2 = await page.locator(`.sklist2 .skic[data-id="${learned[0]}"]`).boundingBox();
    if (b2) { await page.mouse.move(b2.x + b2.width / 2, b2.y + b2.height / 2); await page.mouse.down(); await page.mouse.move(target.x, target.y, { steps: 12 }); await wait(100); await P.shot('skill-dragging'); await page.mouse.up(); await wait(300); }
    const bar = await page.evaluate(() => game.skillBar.slice(0, 6));
    step('拖到 HUD 第 5 格后：' + bar.join(',')); check(bar[4] === learned[0], `拖技能 ${learned[0]} 到 HUD 技能栏失败`);
    await P.shot('skill-dragged');
  }
  await P.closeAll();
  // 世界地图：看看赫顿玛尔（Lv.3 才能去）
  await P.tap('KeyN'); await wait(500); await P.shot('worldmap');
  const pt = page.locator('.wm-node[data-id="hendon_myre"]').first();
  if (await pt.count()) { await pt.click(); await wait(300); await P.shot('worldmap-sel'); }
  step('地图详情：' + await page.evaluate(() => (document.querySelector('.wm-info') || {}).textContent || '').then(t => t.slice(0, 120)));
  await P.closeAll();
}

// ---- 中后期：先用 UI 创建角色，再跳级（testLoadout + 标记前置任务完成），之后全部用真实按键 ----
async function quickStart() {
  await page.goto(`${URL_BASE}?mute&fresh`); await page.waitForFunction(() => window.__READY); await wait(600);
  await page.click('text=进入游戏'); await wait(400); await page.click('#charsel button:has-text("创建角色")'); await wait(400);
  await page.click(`.clscard >> nth=${ci}`); await wait(200); await page.click('text=创建并开始'); await wait(1500);
  if (await page.evaluate(() => menus.isOpen('help'))) await P.tap('Escape');
  await wait(300);
}
async function skipTo(lv, done = []) {
  const r = await page.evaluate(({ lv, done }) => {
    testLoadout(lv); game.exp = 0;
    const d = save.data; for (const q of Object.values(QUESTS)) if (q.type === 'main' && q.lvl < lv - 1 && q.chapter && !q.chapter.includes('天空')) d.questDone[q.id] = 1;
    for (const id of done) d.questDone[id] = 1;
    for (const id of Object.keys(d.quests)) if (d.questDone[id]) delete d.quests[id];
    d.seen = d.seen || {}; for (const id in SCENES) if (!SCENES[id].name.includes('天空')) d.seen[id] = 1;
    if (typeof questDirty === 'function') questDirty(); save.write();
    return { lvl: game.lvl, next: questList(q => questState(q.id) === 'avail' && q.type === 'main').map(q => q.name).slice(0, 3) };
  }, { lv, done });
  step(`跳到 Lv.${r.lvl}，可接主线：${r.next.join('、')}`);
}
// 按场景出口广度优先找路，然后一段一段真实地走过去
async function goScene(target) {
  const path = await page.evaluate(t => { const from = world.S.id, prev = { [from]: null }, q = [from]; while (q.length) { const s = q.shift(); if (s === t) break; for (const ex of SCENES[s].exits) if (SCENES[ex.to] && !ex.locked && !(ex.minLv && game.lvl < ex.minLv) && !(ex.to in prev)) { prev[ex.to] = s; q.push(ex.to); } } if (!(t in prev)) return null; const p = []; for (let s = t; s !== from; s = prev[s]) p.unshift(s); return p; }, target);
  if (!path) { P.note(`从 ${await page.evaluate(() => world.S.id)} 走不到 ${target}`); return false; }
  for (const s of path) if (!(await P.exitTo(s))) return false;
  return true;
}
const MENTOR = ['gsd', 'kiri', 'sharan'][ci];
async function jobTrial() {
  await quickStart();
  await skipTo(15, ['q_job_kill', `q_job_visit_${CLS}`, ...[1, 2, 3, 4, 5, 6].map(i => `q_job_${CLS}_${i}`), 'q_hidden_frozen']);
  await P.shot('lv15');
  const mScene = await page.evaluate(id => qSceneOfNpc(id).id, MENTOR);
  check(await goScene(mScene), `走不到导师所在的 ${mScene}`); await P.shot('mentor-scene');
  check(await P.talk(MENTOR), '和导师对话失败'); await P.shot('mentor-talk');
  const a = await P.dialogTo(['接受']); step('最后的试炼：' + a); await P.closeAll();
  check(await goScene('gf_graca'), '走不到格拉卡区域'); await P.shot('graca-field');
  check(await P.toGate('blazing_graca'), '烈焰格拉卡门口没弹窗'); await P.shot('blazing-gate');
  let tries = 0, ok = false;
  while (!ok && tries < 3) {
    tries++;
    if (tries > 1) { check(await P.toGate('blazing_graca'), '再次进入失败'); }
    await P.enterDungeon(); let rooms = 0;
    const r = await P.fightDungeon({ onRoom: async s => { rooms++; if (s.d.boss) await P.shot(`boss-${tries}`); } });
    step(`烈焰格拉卡第 ${tries} 次：${JSON.stringify(r)}`);
    if (r.state === 'result') { await P.shot(`trial-result-${tries}`); ok = r.hurt <= 30; await P.flipAndReturn(); }
    else { await wait(3000); }
    step('试炼任务：' + await page.evaluate(id => questState(id), `q_job_${CLS}_final`));
  }
  check(ok, `试炼 3 次都没做到被击 ≤30`);
  check(await goScene(mScene), '回不到导师处');
  check(await P.talk(MENTOR), '回来和导师对话失败');
  const b = await P.dialogTo(['完成任务']); step('交试炼：' + b); if (await page.evaluate(() => menus.isOpen('npcquest'))) { await P.shot('trial-reward'); await P.tap('KeyX'); await wait(400); }
  const c = await P.dialogTo(['接受']); step('转职任务：' + c); await P.shot('job-offer');
  await P.closeAll(); check(await P.talk(MENTOR), '再次对话失败');
  await P.npcService('转职'); await wait(500); await P.shot('job-window');
  await page.click('.jobcard >> nth=0'); await wait(300); await P.shot('job-pick');
  await page.click('.jobwin .btn:has-text("转职为")'); await wait(400); await P.shot('job-confirm');
  const conf = page.locator('.askwin .btn:not(.blue)').first(); if (await conf.count()) await conf.click(); else { const c2 = page.locator('.jobwin .btn.red, .jobwin .btn:has-text("确定")').first(); if (await c2.count()) await c2.click(); }
  for (let i = 0; i < 12; i++) { await wait(500); if (i === 2 || i === 6) await P.shot(`job-show-${i}`); }
  step('转职后：job=' + await page.evaluate(() => game.job) + ' 窗口=' + await page.evaluate(() => menus.stack.join(',')));
  await P.closeAll(); await P.tap('KeyK'); await wait(400); await page.click('.sktab:has-text("转职技能")').catch(() => {}); await wait(300); await P.shot('job-skills');
  await P.closeAll();
}
async function awaken() {
  await quickStart();
  await skipTo(18, ['q_job_kill', `q_job_visit_${CLS}`, ...[1, 2, 3, 4, 5, 6].map(i => `q_job_${CLS}_${i}`), `q_job_${CLS}_final`, `q_job_${CLS}_change`, 'q_hidden_frozen', 'q_dark_1', 'q_dark_2', 'q_hidden_dark']);
  await page.evaluate(() => { const j = Object.keys(CLASSES[game.player.cls].jobs)[0]; game.job = j; if (typeof onJobChange === 'function') onJobChange(game.player, j); save.write(); });
  const mScene = await page.evaluate(id => qSceneOfNpc(id).id, MENTOR);
  check(await goScene(mScene), '走不到导师处');
  check(await P.talk(MENTOR), '和导师对话失败'); await P.shot('awaken-offer');
  step('觉醒任务：' + await P.dialogTo(['接受'])); await P.closeAll(); await P.shot('awaken-accepted');
  // 暗黑雷鸣废墟（隐藏地下城）打一次
  check(await goScene('gf_thunder'), '走不到雷鸣废墟区域'); await P.shot('thunder-field');
  check(await P.toGate('dark_thunder'), '暗黑雷鸣废墟门口没弹窗');
  await P.enterDungeon(); const r = await P.fightDungeon({ onRoom: async s => { if (s.d.boss) await P.shot('dark-boss'); } });
  step('暗黑雷鸣废墟：' + JSON.stringify(r)); if (r.state === 'result') { await P.shot('dark-result'); await P.flipAndReturn(); }
  step('觉醒任务进度：' + await page.evaluate(c => JSON.stringify(save.data.quests[`q_awaken_${c}_1`]), CLS));
}
async function hidden() {
  await quickStart();
  await skipTo(10, ['q_job_kill']);
  check(await goScene('hm_oldtown'), '走不到旧城区');
  check(await P.talk('gsd'), '和 G.S.D 对话失败'); await P.shot('gsd');
  if (await page.evaluate(() => npcUI.qid) !== 'q_hidden_frozen') await P.pickQuest('寒气的源头');
  step('寒气的源头：' + await P.dialogTo(['接受'])); await P.closeAll();
  let n = 0;
  while (n++ < 4 && await page.evaluate(() => questState('q_hidden_frozen')) !== 'ready') {
    check(await goScene('gf_thunder'), '走不到雷鸣废墟');
    check(await P.toGate('thunder_ruins'), '雷鸣废墟门口没弹窗'); await P.enterDungeon();
    const r = await P.fightDungeon(); step(`雷鸣废墟第 ${n} 次：${JSON.stringify(r)} 结晶 ${await page.evaluate(() => inv.count('q_frost_crystal'))}`);
    if (r.state === 'result') await P.flipAndReturn();
  }
  check(await goScene('hm_oldtown'), '回不到旧城区'); check(await P.talk('gsd'), '回来和 G.S.D 对话失败');
  step('交任务：' + await P.dialogTo(['完成任务'])); await wait(500); await P.shot('hidden-reward'); await P.closeAll();
  check(await goScene('gf_forest'), '走不到幽暗密林');
  const g = await page.evaluate(() => world.S.gates.find(g => g.dungeon === 'frozen_woods').x);
  await P.walkTo(g + 150, 60); await wait(400); await P.shot('hidden-reveal-1'); await wait(900); await P.shot('hidden-reveal-2'); await wait(1600); await P.shot('hidden-reveal-3');
  check(await P.toGate('frozen_woods'), '冰霜幽暗密林门口没弹窗'); await P.shot('frozen-gate');
}
async function sky() {
  await quickStart();
  await skipTo(16, []);
  check(await goScene('sky_castle'), '走不到天空之城'); await P.shot('sky-field');
  check(await P.toGate('dragon_tower'), '龙人之塔门口没弹窗'); await P.shot('sky-gate');
  await P.enterDungeon(); let k = 0;
  const r = await P.fightDungeon({ onRoom: async s => { if (k++ < 2 || s.d.boss) await P.shot(s.d.boss ? 'sky-boss' : `sky-room${k}`); } });
  step('龙人之塔：' + JSON.stringify(r)); if (r.state === 'result') { await P.shot('sky-result'); await P.flipAndReturn(); }
}
async function duel() {
  await quickStart(); await skipTo(15, []);
  await P.tap('KeyP'); await wait(600); await P.shot('duel-window');
  step('P 打开：' + await page.evaluate(() => menus.stack.join(',')));
  await P.closeAll();
  check(await goScene('hendon_myre'), '走不到市政街'); check(await P.talk('vier'), '和维尔·克鲁对话失败'); await P.shot('vier');
  const sv = await page.evaluate(() => [...menus.wins.npc.querySelectorAll('.npcmenu .btn')].map(b => b.textContent)); step('维尔·克鲁菜单：' + sv.join(' '));
}

try {
  if (leg === 'newbie') { await newbie(); await town(); }
  else if (leg === 'job') await jobTrial();
  else if (leg === 'awaken') await awaken();
  else if (leg === 'hidden') await hidden();
  else if (leg === 'sky') await sky();
  else if (leg === 'duel') await duel();
} catch (e) { P.note('脚本异常：' + e.message.split('\n')[0]); await P.shot('crash').catch(() => {}); fail++; }
console.log('\n问题清单：'); for (const n of P.notes) console.log(' -', n);
console.log('页面报错：', JSON.stringify(errs().slice(0, 8), null, 1));
await browser.close();
process.exit(fail || errs().length ? 1 : 0);
