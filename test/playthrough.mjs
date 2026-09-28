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
    if (r.state === 'result') { await P.shot(`trial-result-${tries}`); ok = r.hurt <= 40; await P.flipAndReturn(); }
    else { await wait(3000); }
    step('试炼任务：' + await page.evaluate(id => questState(id), `q_job_${CLS}_final`));
  }
  check(ok, `试炼 3 次都没做到被击 ≤40`);
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
  // 跳级：已转职（第一个方向）、烈焰格拉卡已经打到勇士难度（相当于之前通关过普通 / 冒险）
  await page.evaluate(() => { const j = Object.keys(CLASSES[game.player.cls].jobs)[0]; game.job = j; if (typeof onJobChange === 'function') onJobChange(game.player, j); save.data.unlocked.blazing_graca = 1; save.data.unlocked.dark_thunder = 1; save.write(); });
  const skip1 = !!process.env.AW_SKIP1;   // 觉醒任务 1（暗黑雷鸣废墟 ×3）这个职业已经实测过：直接记为完成，从任务 2 开始
  if (skip1) await page.evaluate(c => { save.data.questDone[`q_awaken_${c}_1`] = 1; save.write(); }, CLS);
  const mScene = await page.evaluate(id => qSceneOfNpc(id).id, MENTOR);
  check(await goScene(mScene), '走不到导师处');
  check(await P.talk(MENTOR), '和导师对话失败'); await P.shot('aw1-offer');
  step('觉醒任务 1：' + await P.dialogTo(['接受'])); await P.closeAll();
  if (!skip1) {
  // 暗黑雷鸣废墟 ×3（结算时点“再次挑战”，最后一次返回城镇）
  check(await goScene('gf_thunder'), '走不到雷鸣废墟区域'); await P.shot('thunder-field');
  check(await P.toGate('dark_thunder'), '暗黑雷鸣废墟门口没弹窗'); await P.shot('dark-gate');
  await P.enterDungeon();
  for (let i = 1; i <= 3; i++) {
    const r = await P.fightDungeon({ onRoom: async s => { if (s.d.boss && i === 1) await P.shot('dark-boss'); } });
    step(`暗黑雷鸣废墟第 ${i} 次：${JSON.stringify(r)}`);
    if (r.state !== 'result') { P.note(`暗黑雷鸣废墟第 ${i} 次没打到结算：${r.state}`); break; }
    await P.flipAndReturn(i < 3);
  }
  const q1 = await page.evaluate(c => questState(`q_awaken_${c}_1`), CLS); step('觉醒任务 1 状态：' + q1); check(q1 === 'ready', '暗黑雷鸣废墟 3 次后觉醒任务 1 没有达成');
  // 回导师处交任务 1、接任务 2（目标栏里应该出现“勇士级烈焰格拉卡 S 评价”和“30 个无色小晶块”）
  check(await goScene(mScene), '回不到导师处');
  check(await P.talk(MENTOR), '回来和导师对话失败');
  step('交觉醒任务 1：' + await P.dialogTo(['完成任务'])); await wait(500);
  if (await page.evaluate(() => menus.isOpen('npcquest'))) { await P.tap('KeyX'); await wait(400); }
  step('觉醒任务 2：' + await P.dialogTo(['接受'])); await P.shot('aw2-accepted'); await P.closeAll();
  } else { step('觉醒任务 2：' + await page.evaluate(() => npcUI.mode)); await P.shot('aw2-accepted'); await P.closeAll(); }
  // 买 30 个无色小晶块（导师附近的商店：鬼剑士 → 辛达，神枪手 → 诺顿，魔法师 → 卡坤），Shift + 点击输入数量
  const shopNpc = ['sinda', 'norton', 'kakun'][ci];
  const need = await page.evaluate(() => Math.max(0, 30 - inv.count('crystal')));
  if (need > 0) {
    if (await page.evaluate(id => qSceneOfNpc(id).id, shopNpc) !== await page.evaluate(() => world.S.id)) check(await goScene(await page.evaluate(id => qSceneOfNpc(id).id, shopNpc)), '走不到商店');
    check(await P.talk(shopNpc), `和 ${shopNpc} 对话失败`); await P.npcService('商店'); await wait(300);
    await page.click('.shopwin .cat:has-text("材料")').catch(() => {}); await wait(200);
    const row = page.locator('.shopwin .srow', { hasText: '无色小晶块' }).first();
    await row.click({ modifiers: ['Shift'] }); await wait(300);
    await page.fill('.idlg input[type=number]', String(need)); await wait(100); await P.shot('buy-crystal-qty');
    await page.locator('.idlg .row .btn').last().click(); await wait(300);
    await page.click('.shopwin .btn:has-text("购买选中")'); await wait(300);
    if (await page.locator('.idlg').count()) await page.locator('.idlg .row .btn').last().click();
    await wait(300); await P.shot('buy-crystal');
    step('无色小晶块：' + await page.evaluate(() => inv.count('crystal'))); await P.closeAll();
  }
  // 冒险级烈焰格拉卡，A 评价（最多 3 次）
  check(await goScene('gf_graca'), '走不到格拉卡区域');
  let okS = false;
  for (let t = 1; t <= 3 && !okS; t++) {
    check(await P.toGate('blazing_graca'), '烈焰格拉卡门口没弹窗'); if (t === 1) await P.shot('warrior-gate');
    await P.enterDungeon('冒险');
    const r = await P.fightDungeon({ onRoom: async s => { if (s.d.boss && t === 1) await P.shot('warrior-boss'); } });
    step(`冒险级烈焰格拉卡第 ${t} 次：${JSON.stringify(r)}`);
    if (r.state === 'result') { await P.shot(`warrior-result-${t}`); await P.flipAndReturn(); }
    okS = await page.evaluate(c => questRec(`q_awaken_${c}_2`) && goalVal(QUESTS[`q_awaken_${c}_2`], questRec(`q_awaken_${c}_2`), 0) >= 1, CLS);
  }
  check(okS, '冒险级烈焰格拉卡 3 次都没打到 A');
  const q2 = await page.evaluate(c => questState(`q_awaken_${c}_2`), CLS); step('觉醒任务 2 状态：' + q2);
  // 交任务 → 觉醒
  check(await goScene(mScene), '回不到导师处');
  check(await P.talk(MENTOR), '和导师对话失败');
  step('交觉醒任务 2：' + await P.dialogTo(['完成任务'])); await wait(600); await P.shot('awaken-done');
  if (await page.evaluate(() => menus.isOpen('npcquest'))) { await P.tap('KeyX'); await wait(400); }
  await P.closeAll();
  step('觉醒标记：' + await page.evaluate(() => awakenUnlocked()) + ' 晶块剩 ' + await page.evaluate(() => inv.count('crystal')));
  // 学觉醒技能，拖到技能栏最后一格（Y），进地下城按 Y 放出来
  const aw = await page.evaluate(() => { const J = CLASSES[game.player.cls].jobs[game.job]; return J.awaken; });
  await P.tap('KeyK'); await wait(400);
  await page.click('.sktab:has-text("转职技能")'); await wait(300);
  await page.click(`.sklist2 .skic[data-id="${aw}"]`).catch(() => P.note('技能窗口里找不到觉醒技能')); await wait(300);
  await page.click('.skdetail .btn:has-text("学习")').catch(() => P.note('觉醒技能没有“学习”按钮')); await wait(300);
  await P.shot('awaken-skill');
  const lv = await page.evaluate(id => game.skillLv[id] || 0, aw); step(`觉醒技能 ${aw} 等级：${lv}`); check(lv > 0, '觉醒技能学不了');
  const target = await page.evaluate(() => { const R = hudSkillRect(11), r = ucan.getBoundingClientRect(); return { x: r.left + (R.x + R.s / 2) / 1920 * r.width, y: r.top + (R.y + R.s / 2) / 1080 * r.height }; });
  const bx = await page.locator(`.sklist2 .skic[data-id="${aw}"]`).boundingBox();
  if (bx) { await page.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2); await page.mouse.down(); await page.mouse.move(target.x, target.y, { steps: 12 }); await page.mouse.up(); await wait(300); }
  check(await page.evaluate(id => game.skillBar[11] === id, aw), '觉醒技能没拖进技能栏 Y 格');
  await P.closeAll();
  check(await goScene('gf_graca'), '走不到格拉卡区域');
  check(await P.toGate('graca'), '格拉卡门口没弹窗'); await P.enterDungeon();
  const t0 = Date.now(); let cast = false;
  while (Date.now() - t0 < 60000 && !cast) {
    const s = await P.st(); if (!s.en || !s.en.length) { await wait(300); continue; }
    const e = s.en[0]; await P.walkTo(e.x - 80, e.y, { maxMs: 4000 });
    await P.tap('KeyY'); await wait(250);
    cast = await page.evaluate(id => !!(game.cutin) || (game.player.act && game.player.act.id === id) || (game.player.cool[id] || 0) > 0, aw);
  }
  await wait(300); await P.shot('awaken-cast'); await wait(900); await P.shot('awaken-cast2');
  step('觉醒技能释放：' + cast); check(cast, '按 Y 放不出觉醒技能');
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
  await P.npcService('决斗场'); await wait(400);
  await page.click('.duelwin .btn.big'); await page.waitForFunction(() => window.__READY && game.duel, null, { timeout: 30000 }); await wait(1500);
  await P.shot('duel-start');
  // 用键盘打：靠近 → 普攻 / 技能，被打飞了按 C 受身
  const t0 = Date.now(); let k = 0;
  while (Date.now() - t0 < 200000) {
    const s = await page.evaluate(() => { const D = game.duel, a = D.a, b = D.b; return { st: D.state, round: D.round, wins: D.wins, a: { x: a.x, y: a.y, face: a.face, st: a.st }, b: { x: b.x, y: b.y, hp: Math.round(b.hp / b.hpMax * 100) }, hp: Math.round(a.hp / a.hpMax * 100) }; });
    if (s.st === 'result') break;
    const dx = s.b.x - s.a.x, dy = s.b.y - s.a.y;
    if (s.a.st === 'down') { await P.tap('KeyC'); continue; }
    if (Math.abs(dx) < 70 && Math.abs(dy) < 14) { await P.release(); if ((dx > 0 ? 1 : -1) !== s.a.face) { await P.tap(dx > 0 ? 'ArrowRight' : 'ArrowLeft', 30); } await P.tap(++k % 5 === 0 ? ['KeyA', 'KeyS', 'KeyD', 'KeyF'][k % 4] : 'KeyX', 45); if (k === 20) await P.shot('duel-fight'); continue; }
    await P.hold([Math.abs(dx) > 50 ? (dx > 0 ? 'ArrowRight' : 'ArrowLeft') : null, Math.abs(dy) > 8 ? (dy > 0 ? 'ArrowDown' : 'ArrowUp') : null].filter(Boolean)); await wait(60);
  }
  await P.release(); await wait(800); await P.shot('duel-result');
  step('决斗结果：' + JSON.stringify(await page.evaluate(() => game.duel.result)));
  await P.tap('Escape'); await wait(500); await P.shot('duel-esc');
  step('决斗后按 Esc：' + await page.evaluate(() => menus.stack.join(',') + ' | ' + [...document.querySelectorAll('[data-win] .btn')].map(b => b.textContent).join(' ')));
  const leave = page.locator('.sysmenu .btn:has-text("离开决斗场")');
  if (await leave.count()) { await leave.click(); await page.waitForFunction(() => window.__READY && game.scene === 'town', null, { timeout: 30000 }); await wait(800); await P.shot('back-from-duel'); step('离开决斗场后：' + await page.evaluate(() => `${world.S.id} ${save.data.name} Lv.${game.lvl}`)); }
  else P.note('决斗结束后没有回城镇的入口');
}

// ---- 手机（触屏）：用 CDP 的多点触控，一根手指按摇杆，另一根手指点按钮 ----
async function mobile() {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const pg = await ctx.newPage(); pg.on('pageerror', e => logs.push({ type: 'pageerror', text: e.message }));
  const cdp = await ctx.newCDPSession(pg), T = { stick: null };
  const send = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  const pts = extra => [...(T.stick ? [{ x: T.stick.x, y: T.stick.y, id: 0 }] : []), ...(extra || [])];
  const tapXY = async (x, y, ms = 70) => { await send('touchStart', pts([{ x, y, id: 1 }])); await pg.waitForTimeout(ms); await send('touchEnd', pts()); await pg.waitForTimeout(90); };
  const tapSel = async sel => { const b = await pg.locator(sel).first().boundingBox(); if (!b) { P.note(`手机：找不到 ${sel}`); return false; } await tapXY(b.x + b.width / 2, b.y + b.height / 2); return true; };
  const stick = async (dx, dy) => {   // dx, dy ∈ [-1, 1]；0,0 = 松开
    if (!dx && !dy) { if (T.stick) { T.stick = null; await send('touchEnd', []); } return; }
    if (!T.stick) { T.stick = { x: 150, y: 250, bx: 150, by: 250 }; await send('touchStart', pts()); }
    T.stick.x = T.stick.bx + dx * 60; T.stick.y = T.stick.by + dy * 60; await send('touchMove', pts());
  };
  let n = 0; const shot = async name => { const f = `${out}/m${String(++n).padStart(2, '0')}-${name}.png`; await pg.screenshot({ path: f }); console.log('  📷 ' + f); };
  const st = () => pg.evaluate(() => ({ scene: game.scene, sid: world && world.S && world.S.id, x: game.player && game.player.x, y: game.player && game.player.y, menus: menus.stack.slice() }));
  const walkTo = async (x, y, maxMs = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < maxMs) { const s = await st(); const dx = x - s.x, dy = y - s.y; if (Math.abs(dx) < 16 && Math.abs(dy) < 10) break; if (s.menus.length) break; await stick(Math.abs(dx) > 16 ? Math.sign(dx) * (Math.abs(dx) > 250 ? 1 : 0.55) : 0, Math.abs(dy) > 10 ? Math.sign(dy) * 0.7 : 0); await pg.waitForTimeout(60); } await stick(0, 0); };
  const npcXY = id => pg.evaluate(id => { const e = world.npcs.find(x => x.npc.id === id); const r = wcan.getBoundingClientRect(); return { x: r.left + (e.x - cam.x) / WW * r.width, y: r.top + (FLOOR_Y + e.y - e.npc.h * 0.5) / WH * r.height, wx: e.x, wy: e.y }; }, id);
  const talkTap = async id => { const n0 = await npcXY(id); await walkTo(n0.wx - 60, n0.wy + 4); const n1 = await npcXY(id); await tapXY(n1.x, n1.y); await pg.waitForTimeout(500); return pg.evaluate(() => menus.isOpen('npc')); };
  const dlg = async labels => { for (let i = 0; i < 25; i++) { const b = await pg.evaluate(l => { const w = menus.wins.npc; const b = w && [...w.querySelectorAll('.qbtns .btn')].find(b => l.includes(b.textContent.trim())); return b ? b.textContent.trim() : null; }, labels); if (b) { await tapSel(`.npcwin .qbtns .btn:has-text("${b}")`); await pg.waitForTimeout(400); return b; } if (!(await tapSel('.npcwin .qline'))) break; await pg.waitForTimeout(200); } return null; };
  const exitSide = async (to, side) => { const t0 = Date.now(); while (Date.now() - t0 < 20000 && !(await pg.evaluate(t => world.S.id === t, to))) { await stick(side === 'right' ? 1 : -1, 0); await pg.waitForTimeout(100); } await stick(0, 0); await pg.waitForTimeout(800); return pg.evaluate(t => world.S.id === t, to); };
  await pg.goto(`${URL_BASE}?touch&mute&fresh`); await pg.waitForFunction(() => window.__READY); await pg.waitForTimeout(800);
  await shot('title'); await tapSel('text=进入游戏'); await pg.waitForTimeout(500); await shot('charselect');
  await tapSel('#charsel button:has-text("创建角色")'); await pg.waitForTimeout(500); await tapSel(`.clscard >> nth=${ci}`); await pg.waitForTimeout(300); await shot('newgame');
  await tapSel('text=创建并开始'); await pg.waitForTimeout(1600); await shot('help');
  if (await pg.evaluate(() => menus.isOpen('help'))) await tapSel('[data-win="help"] .hd .x');
  await pg.waitForTimeout(400); await shot('seria-room');
  check(await talkTap('seria'), '手机：点赛丽亚没打开对话'); await shot('seria-talk');
  step('手机 赛丽亚：' + await dlg(['接受'])); await tapSel('.npcmenu .btn:has-text("离开")'); await pg.waitForTimeout(300);
  check(await exitSide('elvenguard', 'right'), '手机：出不了房间'); await shot('elvenguard');
  check(await talkTap('linus'), '手机：点林纳斯没打开对话'); step('手机 林纳斯：' + await dlg(['完成任务']));
  if (await pg.evaluate(() => menus.isOpen('npcquest'))) { await shot('reward'); await tapSel('[data-win="npcquest"] .btn'); await pg.waitForTimeout(400); }
  step('手机 林纳斯接：' + await dlg(['接受'])); await tapSel('.npcmenu .btn:has-text("离开")'); await pg.waitForTimeout(300);
  check(await exitSide('gf_lorien', 'right'), '手机：走不到洛兰');
  const g = await pg.evaluate(() => world.S.gates.find(g => g.dungeon === 'lorien').x); await walkTo(g, 40);
  for (let i = 0; i < 30 && !(await pg.evaluate(() => menus.isOpen('dungeon'))); i++) { await stick(0, -1); await pg.waitForTimeout(100); } await stick(0, 0);
  await shot('gate'); await tapSel('text=进入地下城'); await pg.waitForFunction(() => game.scene === 'dungeon' && game.dungeon && game.dungeon.state === 'play', null, { timeout: 20000 }); await pg.waitForTimeout(600); await shot('dungeon');
  // 触屏打怪：摇杆靠近 + 点 X，偶尔点技能
  const atk = await pg.locator('#touch .atk').boundingBox(), sk0 = await pg.locator('#touch .sk').first().boundingBox();
  const t0 = Date.now(); let k = 0;
  while (Date.now() - t0 < 300000) {
    const s = await pg.evaluate(() => { const p = game.player, D = game.dungeon; if (!D || game.scene !== 'dungeon') return { done: true }; const en = ents.filter(e => e.team === 'e' && !e.dead).map(e => ({ x: e.x, y: e.y, w: e.w })); return { res: menus.isOpen('result'), p: { x: p.x, y: p.y, face: p.face }, en, open: D.doorsOpen, route: D.doorsOpen ? bot.route(D) : null, x1: game.room.x1, dead: D.state === 'dead', trans: !!D.transition }; });
    if (s.done || s.res) break;
    if (s.trans) { await stick(0, 0); await pg.waitForTimeout(100); continue; }
    if (s.dead) { await stick(0, 0); await tapXY(atk.x + atk.width / 2, atk.y + atk.height / 2); continue; }
    const t = s.en.sort((a, b) => Math.abs(a.x - s.p.x) - Math.abs(b.x - s.p.x))[0];
    if (t) {
      const dx = t.x - s.p.x, dy = t.y - s.p.y;
      if (Math.abs(dx) < 60 + t.w && Math.abs(dy) < 14) { if (Math.sign(dx) !== s.p.face) { await stick(Math.sign(dx), 0); await pg.waitForTimeout(60); } await stick(0, 0); const b = ++k % 6 === 0 ? sk0 : atk; await tapXY(b.x + b.width / 2, b.y + b.height / 2, 50); if (k === 12) await shot('touch-fight'); continue; }
      await stick(Math.abs(dx) > 40 ? Math.sign(dx) : 0, Math.abs(dy) > 8 ? Math.sign(dy) * 0.8 : 0); await pg.waitForTimeout(60); continue;
    }
    if (s.open && s.route) { const tx = s.route === 'left' ? 0 : s.route === 'right' ? s.x1 : s.x1 / 2; const vx = s.route === 'up' || s.route === 'down' ? (Math.abs(tx - s.p.x) > 30 ? Math.sign(tx - s.p.x) : 0) : Math.sign(tx - s.p.x); await stick(vx, s.route === 'up' ? -1 : s.route === 'down' ? 1 : 0); await pg.waitForTimeout(80); continue; }
    await stick(0, 0); await pg.waitForTimeout(100);
  }
  await stick(0, 0);
  await pg.waitForFunction(() => menus.isOpen('result'), null, { timeout: 30000 }).catch(() => P.note('手机：没打到结算'));
  await pg.waitForTimeout(1200); await shot('result'); await tapSel('#result .card'); await pg.waitForTimeout(900); await shot('result-flip');
  await tapSel('text=返回城镇'); await pg.waitForTimeout(1500); await shot('back');
  // 窗口：包、技能、任务
  for (const [b, nm] of [['包', 'inv'], ['技', 'skills'], ['任', 'quests']]) { await tapSel(`#touch .tmisc .tbtn:has-text("${b}")`); await pg.waitForTimeout(500); await shot('win-' + nm); step(`手机 ${b} → ${await pg.evaluate(() => menus.stack.join(','))}`); await tapSel(`[data-win="${nm}"] .hd .x`); await pg.waitForTimeout(300); }
  await ctx.close();
}

try {
  if (leg === 'newbie') { await newbie(); await town(); }
  else if (leg === 'mobile') await mobile();
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
