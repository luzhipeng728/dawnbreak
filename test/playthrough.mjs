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

async function town() {
  // 商店：林纳斯（多选购买）
  check(await P.talk('linus'), '和林纳斯对话失败');
  const svc = await page.evaluate(() => [...menus.wins.npc.querySelectorAll('.npcmenu .btn')].map(b => b.textContent));
  step('林纳斯菜单：' + svc.join(' '));
  await P.npcService('商店'); await P.shot('shop');
  step('商店窗口：' + await page.evaluate(() => menus.stack.join(',')));
}

try {
  if (leg === 'newbie') { await newbie(); await town(); }
} catch (e) { P.note('脚本异常：' + e.message.split('\n')[0]); await P.shot('crash').catch(() => {}); fail++; }
console.log('\n问题清单：'); for (const n of P.notes) console.log(' -', n);
console.log('页面报错：', JSON.stringify(errs().slice(0, 8), null, 1));
await browser.close();
process.exit(fail || errs().length ? 1 : 0);
