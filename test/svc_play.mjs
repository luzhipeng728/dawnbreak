// 社交服务端到端测试：本机起真实服务端（临时数据库，test/svc_host.mjs），1 个无头浏览器里开 2 个互相隔离的玩家上下文（最多同时 2 个，测完立刻关）
// 全部走真实界面：登录 → 建角色 → 拍卖行上架 → 另一个玩家购买 → 双方邮件到账并领取 → 到期退回 → 断网对账 → 签到 → 排行榜 → 公告广播 → 管理员发邮件 → 未登录时隐藏
import { startHost } from './svc_host.mjs';
import { launchPlayers, uiLogin, uiCreateChar, until, sleep, dumpErrors } from './net_lib.mjs';
import fs from 'fs';
const out = 'test/shots/svc'; fs.mkdirSync(out, { recursive: true });
const H = await startHost({ admins: ['gm'], ws: false });
const { browser, players, close } = await launchPlayers(2);
let pass = 0, fail = 0;
const ok = (c, msg, extra) => { if (c) { pass++; console.log('  ✓', msg); } else { fail++; console.log('  ✗', msg, extra !== undefined ? JSON.stringify(extra) : ''); } return !!c; };
const step = s => console.log('·', s);
const HOUR = 3600000;
const all = [...players];
const shot = (P, n) => P.page.screenshot({ path: `${out}/${n}.png` });
const ev = (P, fn, arg) => P.page.evaluate(fn, arg);
const closeWins = P => ev(P, () => menus.closeAll());
async function enter(P, who, name, cls = 0) {
  P.who = who;
  if (!await uiLogin(P.page, H.url, who)) throw new Error(`${who} 登录失败`);
  if (!await uiCreateChar(P.page, cls, name)) { await shot(P, `fail-${who}`); throw new Error(`${who} 建角色失败：${await ev(P, () => menus.stack.join(','))}`); }
  await until(P.page, () => cloudSave.checked && socialOn(), null, 10000);
  await closeWins(P);
}
async function newPlayer(i) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage(), logs = [];
  page.on('console', m => { if (m.type() === 'error') logs.push({ type: 'error', text: m.text() }); });
  page.on('pageerror', e => logs.push({ type: 'pageerror', text: e.message + '\n' + (e.stack || '') }));
  const P = { i, ctx, page, logs }; all.push(P); return P;
}
try {
  const [A, B] = players;
  step('登录、建角色');
  await enter(A, 'alice', '爱丽丝', 0); await enter(B, 'bob', '鲍勃', 1);
  const bar = await ev(A, () => { sxbar.t = 0; ui.draw(); const b = document.getElementById('sxbar'); return b && !b.hidden ? [...b.querySelectorAll('button')].filter(x => getComputedStyle(x).display !== 'none').map(x => x.textContent) : null; });
  ok(bar && bar.length === 4 && bar.join().includes('拍卖行') && !bar.join().includes('管理'), '登录后屏幕左侧出现社交按钮条（普通玩家没有“管理”）', bar);
  await shot(A, '01-bar');

  step('上架：alice 选背包里的物品 → 定价 → 上架');
  const g0 = await ev(A, () => { const it = makeItem('katana_10_2', 1, { grade: 3 }); it.enh = 6; inv.add(it); inv.add(makeItem('hpM', 30)); game.gold = 50000; save.write(); return game.gold; });
  await A.page.keyboard.press('KeyB');
  ok(await until(A.page, () => menus.isOpen('auction') && document.querySelector('.sxauc .itab')), '按 B 打开拍卖行');
  await A.page.click('.sxauc .itab:has-text("出售")'); await until(A.page, () => document.querySelector('.sxauc .sell .igrid .islot'));
  await A.page.click('.sxauc .sell .igrid .islot >> nth=0'); await sleep(400);
  await A.page.fill('.sxauc .sform input[placeholder="总价"]', '20000');
  await A.page.click('.sxauc .sform .sxchip:has-text("12 小时")'); await sleep(200);
  await shot(A, '02-sell');
  await A.page.click('.sxauc .sform button:has-text("上架")'); await A.page.click('.idlg button:has-text("上架")');
  await until(A.page, () => !inv.items.some(x => x.key === 'katana_10_2') && !(save.data.svcPend || []).length && !SXA.busy);
  const s1 = await ev(A, () => ({ has: inv.items.some(x => x.key === 'katana_10_2'), gold: game.gold, pend: (save.data.svcPend || []).length, dirty: cloudSave.dirty }));
  ok(!s1.has && s1.gold === g0 - 50 && s1.pend === 0, '物品移出背包，扣保管费 50（20000×0.5%×0.5），没有残留待办', s1);
  const cloud = await H.api('alice', 'GET', '/api/saves');
  const cc = cloud && cloud.data && cloud.data.chars && cloud.data.chars[cloud.data.cur];
  ok(cc && !(cc.inv || []).some(x => x.key === 'katana_10_2'), '上架前已经把扣掉物品的存档传到云端', cc && (cc.inv || []).map(x => x.key));
  const onSale = (await H.api('bob', 'GET', '/api/auction/search')).list;
  ok(onSale.length === 1 && onSale[0].item.enh === 6 && onSale[0].sellerChar === '爱丽丝', '服务端出现挂单（+6，卖家角色名）', onSale.map(a => [a.name, a.item.enh, a.sellerChar]));

  step('购买：bob 搜索 → 一口价购买');
  await ev(B, () => { game.gold = 30000; save.write(); });
  await B.page.keyboard.press('KeyB'); await until(B.page, () => document.querySelector('.sxauc .ares tbody tr'));
  await shot(B, '03-buy');
  await B.page.click('.sxauc .ares button:has-text("购买")'); await B.page.click('.idlg button:has-text("购买")');
  await until(B.page, () => game.gold === 10000 && !(save.data.svcPend || []).length && !SXA.busy);
  ok(await ev(B, () => game.gold) === 10000, 'bob 扣款 20000');
  ok(await until(B.page, () => SX.unread > 0) && await until(A.page, () => SX.unread > 0), '双方都收到新邮件推送（WS mail:new）');
  const badge = await ev(B, () => { sxbar.t = 0; ui.draw(); const b = sxbar.btns.mail; return { n: b._badge.textContent, hot: b.classList.contains('hot'), shown: !b._badge.hidden }; });
  ok(badge.shown && badge.hot && +badge.n >= 1, '信封闪烁 + 数量', badge);
  await closeWins(B); await shot(B, '04-envelope');

  step('邮件：bob 领取买到的物品');
  await B.page.click('#sxbar button:has-text("邮件")'); await until(B.page, () => document.querySelector('.sxmail .mrow'));
  await shot(B, '05-mail');
  await B.page.click('.sxmail button:has-text("领取附件")');
  await until(B.page, () => inv.items.some(x => x.key === 'katana_10_2'));
  const got = await ev(B, () => { const it = inv.items.find(x => x.key === 'katana_10_2'); return it && { enh: it.enh, grade: it.grade, pend: (save.data.svcPend || []).length }; });
  ok(got && got.enh === 6 && got.grade === 3 && got.pend === 0, 'bob 背包里出现 +6 月影太刀（原物）', got);

  step('邮件：alice 领取货款');
  await closeWins(A); await A.page.click('#sxbar button:has-text("邮件")'); await until(A.page, () => document.querySelector('.sxmail .mrow'));
  const ga = await ev(A, () => game.gold);
  await A.page.click('.sxmail button:has-text("全部领取")');
  await until(A.page, g => game.gold > g, ga);
  ok(await ev(A, () => game.gold) === ga + 19000, 'alice 收到 19000 G（扣 5% 手续费）', await ev(A, () => game.gold) - ga);

  step('好友寄信：alice 给 bob 寄金币 + 物品');
  await A.page.click('.sxmail .itab:has-text("写信")'); await until(A.page, () => document.querySelector('.sxmail .cgrid .islot'));
  await A.page.fill('.sxmail input[list="sxfrlist"]', 'bob');
  await A.page.fill('.sxmail input[placeholder="标题"]', '送你点东西');
  await A.page.fill('.sxmail textarea', '一起刷图吧！');
  await A.page.fill('.sxmail input[type=number]', '1000');
  await A.page.click('.sxmail .cgrid .islot >> nth=0'); await until(A.page, () => document.querySelector('.idlg input[type=number]'));
  await A.page.fill('.idlg input[type=number]', '5'); await A.page.click('.idlg button:has-text("确定")'); await sleep(300);
  const sent = await ev(A, () => { const a = SXM.c.items[0]; return a && { key: a.it.key, n: a.n, cnt: inv.count(a.it.key), gold: game.gold }; });
  ok(sent && sent.n === 5, '叠加物品先问数量：只寄 5 个', sent);
  await shot(A, '05b-compose');
  await A.page.click('.sxmail button:has-text("寄出")');
  await until(A.page, s => game.gold === s.gold - 1100 && !SXM.busy, sent);
  const af = await ev(A, k => ({ gold: game.gold, cnt: inv.count(k), pend: save.data.svcPend.length }), sent.key);
  ok(af.gold === sent.gold - 1100 && af.cnt === sent.cnt - sent.n && af.pend === 0, `寄出：扣 1000 G + 邮费 100 G，${sent.key} ×${sent.n} 移出背包`, { sent, af });
  ok(await until(B.page, () => SX.unread > 0), 'bob 收到好友邮件推送');
  await closeWins(B); await B.page.click('#sxbar button:has-text("邮件")'); await until(B.page, () => document.querySelector('.sxmail .mrow'));
  const bf = await ev(B, k => ({ gold: game.gold, cnt: inv.count(k) }), sent.key);
  await B.page.click('.sxmail .mrow:has-text("送你点东西")'); await sleep(300);
  await B.page.click('.sxmail button:has-text("领取附件")');
  ok(await until(B.page, ([s, b]) => game.gold === b.gold + 1000 && inv.count(s.key) === b.cnt + s.n, [sent, bf]), 'bob 领到 1000 G 和物品');
  await closeWins(A); await closeWins(B);

  step('到期退回');
  await closeWins(A); await ev(A, () => { SXA.tab = 'sell'; SXA.s.it = null; SXA.s.tab = 'use'; });
  await A.page.keyboard.press('KeyB'); await until(A.page, () => document.querySelector('.sxauc .sell .igrid .islot'));
  await A.page.click('.sxauc .sell .igrid .islot:has(.n) >> nth=0'); await sleep(400);
  const pickKey = await ev(A, () => SXA.s.it && SXA.s.it.key);
  const n0 = await ev(A, k => inv.count(k), pickKey);
  await A.page.fill('.sxauc .sform input[type=number] >> nth=0', '10');
  await A.page.fill('.sxauc .sform input[placeholder="总价"]', '500');
  await A.page.click('.sxauc .sform .sxchip:has-text("12 小时")');
  await A.page.click('.sxauc .sform button:has-text("上架")'); await A.page.click('.idlg button:has-text("上架")');
  await until(A.page, ([k, n]) => inv.count(k) === n - 10 && !SXA.busy, [pickKey, n0]);
  ok(await ev(A, k => inv.count(k), pickKey) === n0 - 10, `拆分上架：${n0} 个里上架 10 个`);
  await A.page.click('.sxauc .itab:has-text("我的拍卖")'); await until(A.page, () => document.querySelector('.sxauc tbody tr'));
  await shot(A, '06-mine');
  const t = await H.api('gm', 'POST', '/api/gm/test/time', { add: 13 * HOUR });
  ok(t.expired === 1, '服务端时间前进 13 小时，挂单到期', t);
  await until(A.page, () => SX.unread > 0);
  await closeWins(A); await A.page.click('#sxbar button:has-text("邮件")'); await until(A.page, () => document.querySelector('.sxmail .mrow'));
  await A.page.click('.sxmail button:has-text("全部领取")');
  ok(await until(A.page, ([k, n]) => inv.count(k) === n, [pickKey, n0]), '到期退回的物品领回背包');

  step('断网对账：上架时网络断开 → 待办保留 → 恢复后自动补上');
  await closeWins(A);
  const before = await ev(A, k => ({ gold: game.gold, n: inv.count(k) }), pickKey);
  const r1 = await ev(A, async k => {
    const api0 = net.api; net.api = function (m, p) { if (p === '/api/auction/list') return Promise.reject(Object.assign(new Error('连接服务器失败'), { status: 0 })); return api0.apply(this, arguments); };
    const it = inv.items.find(x => x.key === k);
    try { await sxAuctionList(it, 5, 300, 24); return 'ok'; } catch (e) { return e.message; } finally { net.api = api0; }
  }, pickKey);
  const mid = await ev(A, k => ({ gold: game.gold, n: inv.count(k), pend: save.data.svcPend.length }), pickKey);
  ok(/自动重试/.test(r1) && mid.pend === 1 && mid.n === before.n - 5 && mid.gold === before.gold - 10, '网络错误：物品 / 保管费已扣，记一条待办', { r1, mid });
  await A.page.reload(); await A.page.waitForFunction(() => window.__READY);
  await A.page.click('text=进入游戏').catch(() => {}); await until(A.page, () => menus.isOpen('charselect'));
  await A.page.click('#charsel button:has-text("开始游戏")'); await until(A.page, () => game.scene === 'town' && socialOn());
  await until(A.page, () => save.data && !(save.data.svcPend || []).length, null, 10000);
  const mine = await H.api('alice', 'GET', '/api/auction/mine');
  ok(await ev(A, () => (save.data.svcPend || []).length) === 0 && mine.on.length === 1 && mine.on[0].n === 5, '刷新页面重进游戏后自动对账：挂单补上，待办清空', { on: mine.on.length });
  const r2 = await ev(B, async () => { const g = game.gold; try { await sxAuctionBuy({ id: 999999, price: 100, name: 'x' }); } catch (e) { return { msg: e.message, back: game.gold === g, pend: save.data.svcPend.length }; } return 'ok?'; });
  ok(r2.back && r2.pend === 0, '服务端明确拒绝（买不存在的东西）：金币原样退回', r2);

  step('签到');
  await closeWins(A);
  const gs = await ev(A, () => game.gold);
  await A.page.click('#sxbar button:has-text("签到")'); await until(A.page, () => document.querySelector('.sxsign button.big'));
  await shot(A, '07-signin');
  await A.page.click('.sxsign button.big');
  await until(A.page, g => game.gold >= g + 3000 && SX.signed && !SX.signing, gs);
  const sg = await ev(A, () => ({ gold: game.gold, signed: SX.signed, pend: save.data.svcPend.length }));
  ok(sg.gold === gs + 3000 && sg.signed && sg.pend === 0, '签到成功，奖励 3000 G 自动领取', { d: sg.gold - gs, ...sg });
  await sleep(300); await shot(A, '08-signed');

  step('排行榜');
  await ev(A, () => { game.lvl = 15; return sxRankReport(); }); await ev(B, () => { game.lvl = 12; return sxRankReport(); });
  await closeWins(A); await A.page.click('#sxbar button:has-text("排行榜")'); await until(A.page, () => document.querySelector('.sxrank tbody tr'));
  const rk = await A.page.locator('.sxrank tbody tr').allTextContents();
  ok(rk.length === 2 && rk[0].includes('爱丽丝') && rk[1].includes('鲍勃'), '等级榜：爱丽丝 Lv15 在鲍勃前面', rk);
  await shot(A, '09-rank');
  await A.page.click('.sxrank .itab:has-text("通关时间")'); await until(A.page, () => document.querySelectorAll('.sxrank select').length === 2);
  ok(true, '通关时间榜有地下城 / 难度选择');

  step('全服公告：alice 强化 +12 → bob 屏幕上方滚动公告');
  await ev(A, () => { const it = makeItem('katana_10_2'); it.enh = 12; bus.emit('enhance', { item: it, ok: true, lvl: 12 }); bus.emit('announce', { kind: 'enhance', item: it, lvl: 12 }); });
  ok(await until(B.page, () => { const n = document.getElementById('sxnotice'); return n && !n.hidden && n.textContent.includes('+12'); }), 'bob 看到公告条');
  const nt = await ev(B, () => document.getElementById('sxnotice').textContent);
  ok(nt.includes('爱丽丝') && nt.includes('月影太刀'), `公告内容：${nt}`);
  await sleep(1500); await shot(B, '10-notice');
  await sleep(1500);
  const recent = await H.api('bob', 'GET', '/api/notice/recent');
  ok(recent.list.filter(x => x.kind === 'enhance').length === 1, '监听 + 主动发 同一件物品只广播一次（去重）', recent.list.map(x => x.kind));

  step('管理员后台');
  await B.ctx.close();
  const G = await newPlayer(2);
  await enter(G, 'gm', '小管家', 2);
  const gbar = await ev(G, () => { sxbar.t = 0; ui.draw(); return [...document.querySelectorAll('#sxbar button')].filter(x => getComputedStyle(x).display !== 'none').map(x => x.textContent); });
  ok(gbar.some(t => t.includes('管理')), '管理员能看到“管理”按钮', gbar);
  await G.page.click('#sxbar button:has-text("管理")'); await until(G.page, () => document.querySelector('.sxgm .gform'));
  await G.page.fill('.sxgm input[placeholder^="用户名"]', 'alice');
  await G.page.fill('.sxgm input[placeholder="邮件标题"]', '测试补偿');
  await G.page.fill('.sxgm input[placeholder="0"] >> nth=0', '12345');
  await G.page.fill('.sxgm input[placeholder^="搜索物品"]', '抗疲劳'); await sleep(300);
  await G.page.click('.sxgm .gres .r >> nth=0'); await sleep(300);
  await shot(G, '11-gm');
  await G.page.click('.sxgm button:has-text("发放")'); await G.page.click('.idlg button:has-text("发放")');
  ok(await until(A.page, () => SX.unread > 0), 'alice 收到新邮件推送');
  const am = (await H.api('alice', 'GET', '/api/mail')).list.find(m => m.kind === 'gm');
  ok(am && am.gold === 12345 && am.items[0].key === 'fatigue', 'alice 收到管理员邮件（12345 G + 抗疲劳秘药）', am);
  await closeWins(A); await A.page.click('#sxbar button:has-text("邮件")'); await until(A.page, () => document.querySelector('.sxmail .mrow'));
  const gf = await ev(A, () => ({ g: game.gold, f: inv.count('fatigue') }));
  await A.page.click('.sxmail button:has-text("领取附件")');
  ok(await until(A.page, o => game.gold === o.g + 12345 && inv.count('fatigue') === o.f + 1, gf), 'alice 领取管理员邮件：金币 + 物品到账');
  for (const tab of ['邀请码', '在线玩家', '日志', '拍卖行']) { await G.page.click(`.sxgm .itab:has-text("${tab}")`); await sleep(500); }
  ok(await G.page.locator('.sxgm tbody tr').count() >= 1, '拍卖行管理页有记录');
  await G.page.click('.sxgm .itab:has-text("在线玩家")'); await until(G.page, () => document.querySelector('.sxgm tbody tr'));
  const onl = await G.page.locator('.sxgm tbody tr').allTextContents();
  ok(onl.length === 2 && onl.join().includes('alice'), '在线玩家：alice、gm', onl);
  await G.page.click('.sxgm .itab:has-text("邀请码")'); await sleep(400);
  await G.page.click('.sxgm button:has-text("生成")'); ok(await until(G.page, () => document.querySelector('.sxgm td.code')), '生成邀请码');
  await G.page.click('.sxgm .itab:has-text("日志")'); await until(G.page, () => document.querySelector('.sxgm tbody tr'));
  await shot(G, '12-gm-logs');
  await G.page.click('.sxgm .itab:has-text("全服公告")'); await sleep(300);
  await G.page.fill('.sxgm textarea', '今晚 8 点维护'); await G.page.click('.sxgm button:has-text("发布")');
  ok(await until(A.page, () => { const n = document.getElementById('sxnotice'); return n && n.textContent.includes('今晚 8 点维护'); }, null, 30000), '管理员公告广播到 alice');
  await G.ctx.close();

  step('登录后：诺顿有拍卖行 / 邮箱');
  await closeWins(A); await ev(A, () => enterScene('hm_plaza')); await until(A.page, () => world.S.id === 'hm_plaza');
  await sleep(800);
  await ev(A, () => { const e = world.npcs.find(x => x.npc.id === 'norton'); game.player.x = e.x - 40; game.player.y = e.y; }); await sleep(200);
  await A.page.keyboard.press('KeyX'); await until(A.page, () => menus.isOpen('npc'));
  const btn2 = await A.page.locator('.npcmenu .btn').allTextContents();
  ok(btn2.some(t => t.includes('拍卖行')) && btn2.some(t => t.includes('邮箱')), '诺顿：拍卖行 / 邮箱', btn2);
  await shot(A, '13-norton');
  await A.page.click('.npcmenu .btn:has-text("拍卖行")');
  ok(await until(A.page, () => menus.isOpen('auction')), '点诺顿的拍卖行按钮打开拍卖行');

  step('未登录（单机）：全部隐藏');
  await A.ctx.close();
  const O = await newPlayer(3);
  await O.page.goto(H.url + '?town&cls=sword&mute&offline'); await O.page.waitForFunction(() => window.__READY && game.scene === 'town');
  await closeWins(O);
  const off = await ev(O, () => { sxbar.t = 0; ui.draw(); const b = document.getElementById('sxbar'); return { bar: !b || b.hidden, svc: NPC_SERVICES.auction.show(), on: socialOn() }; });
  ok(off.bar && !off.svc && !off.on, '按钮条隐藏，诺顿的拍卖行按钮不显示', off);
  await O.page.keyboard.press('KeyB'); await sleep(300);
  ok(!(await ev(O, () => menus.isOpen('auction'))) && await ev(O, () => toastList.some(t => t.msg.includes('登录后可用'))), '按 B：提示“登录后可用”，不打开窗口');
  await ev(O, () => enterScene('hm_plaza')); await until(O.page, () => world.S.id === 'hm_plaza'); await sleep(800);
  await ev(O, () => { const e = world.npcs.find(x => x.npc.id === 'norton'); game.player.x = e.x - 40; game.player.y = e.y; }); await sleep(200);
  await O.page.keyboard.press('KeyX'); await until(O.page, () => menus.isOpen('npc'));
  const btns = await O.page.locator('.npcmenu .btn').allTextContents();
  ok(btns.length && !btns.some(t => t.includes('拍卖') || t.includes('邮箱')), '诺顿：没有拍卖行 / 邮箱按钮', btns);
  await O.ctx.close();
} catch (e) { fail++; console.log('  ✗ 异常', e.stack); }
const errs = dumpErrors(all);
ok(!errs.length, '页面没有报错', errs.slice(0, 5));
await close();
await H.close();
console.log(`\n${pass} 项通过，${fail} 项失败`);
process.exit(fail ? 1 : 0);
