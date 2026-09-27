// 社交服务界面测试（联机组服务端合并前的版本）：test/svc_host.mjs 起最小宿主 + 网页版，页面里注入一个假的 net 层（net.api 走真 HTTP，
// WS 推送由测试脚本从宿主取出后转发给页面）。一个无头浏览器、两个上下文（alice / bob），最后换成 gm 测管理员后台、再测未登录。
// 覆盖：上架 → 另一个人购买 → 双方邮件到账并领取、到期退回、断网对账、签到、排行榜、公告广播、管理员发邮件、未登录时隐藏
import { launch } from './lib.mjs';
import { startHost } from './svc_host.mjs';
import fs from 'fs';
const out = 'test/shots/svc'; fs.mkdirSync(out, { recursive: true });
const H = await startHost({ admins: ['gm'] });
const { browser, logs } = await launch({ width: 1280, height: 720 });
let pass = 0, fail = 0;
const ok = (c, msg, extra) => { if (c) { pass++; console.log('  ✓', msg); } else { fail++; console.log('  ✗', msg, extra !== undefined ? JSON.stringify(extra) : ''); } };
const step = s => console.log('·', s);
const wait = ms => new Promise(r => setTimeout(r, ms));
const HOUR = 3600000;
const shim = ({ id, name, admin }) => {
  const tok = name;
  window.netOn = () => true;
  window.net = {
    user: { id, name, admin }, connected: true, handlers: {}, fail: null,
    async api(method, path, body) {
      if (this.fail && this.fail(method, path)) throw Object.assign(new Error('网络断开'), { status: 0 });
      const r = await fetch(path, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: body ? JSON.stringify(body) : undefined });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw Object.assign(new Error(d.error || 'HTTP ' + r.status), { status: r.status, data: d });
      return d;
    },
    on(t, fn) { (this.handlers[t] ||= []).push(fn); return () => {}; }, off() {}, send() { return false; },
  };
  window.__netEmit = m => (net.handlers[m.t] || []).forEach(f => f(m));
};
async function openPlayer(who, cls = 'sword') {
  const u = H.users.find(x => x.name === who);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', e => logs.push({ type: 'pageerror', who, text: e.message + '\n' + e.stack }));
  page.on('console', m => { if (m.type() === 'error') logs.push({ type: 'console', who, text: m.text() }); });
  if (u) await page.addInitScript(shim, { id: u.id, name: u.name, admin: u.admin });
  await page.goto(`${H.base}/index.html?town&cls=${cls}&mute&notype`);
  await page.waitForFunction(() => window.__READY && game.scene === 'town', null, { timeout: 60000 });
  await page.evaluate(() => { while (menus.stack.length) menus.close(menus.stack[menus.stack.length - 1]); save.data.name = save.data.name || '勇士'; });
  if (u) await page.evaluate(n => { save.data.name = n; bus.emit('netLogin', { user: net.user }); }, { alice: '爱丽丝', bob: '鲍勃', gm: '管理员' }[who]);
  await wait(600);
  return { ctx, page, who };
}
// 把宿主记录的 WS 推送转发给页面
const relay = async P => { const L = H.msgs(P.who); for (const m of L) await P.page.evaluate(m => __netEmit(m), m); return L; };
const shot = (P, n) => P.page.screenshot({ path: `${out}/${n}.png` });
const ev = (P, fn, arg) => P.page.evaluate(fn, arg);
const closeAll = P => ev(P, () => { while (menus.stack.length) menus.close(menus.stack[menus.stack.length - 1]); });
try {
  const A = await openPlayer('alice'), B = await openPlayer('bob');
  step('登录后：左上角社交按钮条');
  const bar = await ev(A, () => { const b = document.getElementById('sxbar'); return b && !b.hidden ? [...b.querySelectorAll('button')].filter(x => !x.hidden).map(x => x.textContent) : null; });
  ok(bar && bar.length === 4 && bar.join().includes('拍卖行'), '按钮条显示 4 个按钮（管理员按钮对普通玩家隐藏）', bar);
  await shot(A, '01-bar');

  step('上架：alice 选背包里的物品 → 定价 → 上架');
  const g0 = await ev(A, () => { inv.items.length = 0; const it = makeItem('katana_10_2', 1, { grade: 3, enh: 0 }); it.enh = 6; inv.add(it); inv.add(makeItem('hpM', 30)); game.gold = 50000; save.write(); return game.gold; });
  await A.page.keyboard.press('KeyB'); await wait(700);
  ok(await ev(A, () => menus.isOpen('auction')), '按 B 打开拍卖行');
  await A.page.click('.sxauc .itab:has-text("出售")'); await wait(700);
  await A.page.click('.sxauc .sell .igrid .islot >> nth=0'); await wait(500);
  await A.page.fill('.sxauc .sform input[placeholder="总价"]', '20000');
  await A.page.click('.sxauc .sform .sxchip:has-text("12 小时")'); await wait(200);
  await shot(A, '02-sell');
  await A.page.click('.sxauc .sform button:has-text("上架")'); await wait(300);
  await A.page.click('.idlg button:has-text("上架")'); await wait(1200);
  const s1 = await ev(A, () => ({ has: inv.items.some(x => x.key === 'katana_10_2'), gold: game.gold, pend: (save.data.svcPend || []).length }));
  ok(!s1.has && s1.gold === g0 - 50 && s1.pend === 0, '物品移出背包，扣保管费 50（20000×0.5%×0.5），没有残留待办', s1);
  const onSale = (await H.api('bob', 'GET', '/api/auction/search')).list;
  ok(onSale.length === 1 && onSale[0].item.enh === 6 && onSale[0].sellerChar === '爱丽丝', '服务端出现挂单（+6，卖家角色名）', onSale.map(a => [a.name, a.item.enh]));

  step('购买：bob 搜索 → 一口价购买');
  await ev(B, () => { game.gold = 30000; save.write(); });
  await B.page.keyboard.press('KeyB'); await wait(900);
  await shot(B, '03-buy');
  const rows = await B.page.locator('.sxauc .ares tbody tr').count();
  ok(rows === 1, '购买页看到 1 件', rows);
  await B.page.click('.sxauc .ares button:has-text("购买")'); await wait(300);
  await B.page.click('.idlg button:has-text("购买")'); await wait(1200);
  ok(await ev(B, () => game.gold) === 10000, 'bob 扣款 20000');
  await relay(B); await relay(A); await wait(300);
  const badge = await ev(B, () => { sxbar.t = 0; ui.draw(); const b = sxbar.btns.mail; return { n: b._badge.textContent, hot: b.classList.contains('hot'), shown: !b._badge.hidden }; });
  ok(badge.shown && badge.hot && +badge.n >= 1, '新邮件：信封闪烁 + 数量', badge);
  await shot(B, '04-envelope');

  step('邮件：bob 领取买到的物品');
  await ev(B, () => menus.closeAll()); await B.page.click('#sxbar button:has-text("邮件")'); await wait(900);
  await shot(B, '05-mail');
  await B.page.click('.sxmail button:has-text("领取附件")'); await wait(1200);
  const got = await ev(B, () => { const it = inv.items.find(x => x.key === 'katana_10_2'); return it && { enh: it.enh, grade: it.grade, pend: (save.data.svcPend || []).length }; });
  ok(got && got.enh === 6 && got.grade === 3 && got.pend === 0, 'bob 背包里出现 +6 寒光太刀（原物）', got);

  step('邮件：alice 领取货款');
  await A.page.click('#sxbar button:has-text("邮件")'); await wait(900);
  const ga = await ev(A, () => game.gold);
  await A.page.click('.sxmail button:has-text("全部领取")'); await wait(1200);
  ok(await ev(A, () => game.gold) === ga + 19000, 'alice 收到 19000 G（扣 5% 手续费）', await ev(A, () => game.gold) - ga);

  step('到期退回');
  await ev(A, () => { menus.closeAll(); SXA.tab = 'sell'; SXA.s.it = null; });
  await A.page.keyboard.press('KeyB'); await wait(800);
  await A.page.click('.sxauc .sell .itab:has-text("消耗品")'); await wait(300);
  await A.page.click('.sxauc .sell .igrid .islot >> nth=0'); await wait(400);
  await A.page.fill('.sxauc .sform input[type=number] >> nth=0', '10');
  await A.page.fill('.sxauc .sform input[placeholder="总价"]', '500');
  await A.page.click('.sxauc .sform .sxchip:has-text("12 小时")');
  await A.page.click('.sxauc .sform button:has-text("上架")'); await wait(300);
  await A.page.click('.idlg button:has-text("上架")'); await wait(1200);
  ok(await ev(A, () => inv.count('hpM')) === 20, '拆分上架：30 个药剂上架 10 个，剩 20');
  await A.page.click('.sxauc .itab:has-text("我的拍卖")'); await wait(800);
  await shot(A, '06-mine');
  const t = await H.api('gm', 'POST', '/api/gm/test/time', { add: 13 * HOUR });
  ok(t.expired === 1, '时间前进 13 小时，挂单到期', t);
  await relay(A);
  await ev(A, () => menus.closeAll()); await A.page.click('#sxbar button:has-text("邮件")'); await wait(900);
  await A.page.click('.sxmail button:has-text("全部领取")'); await wait(1200);
  ok(await ev(A, () => inv.count('hpM')) === 30, '到期退回的药剂领回背包（30 个）');

  step('断网对账：上架时网络断开 → 待办保留 → 恢复后自动补上');
  const before = await ev(A, () => ({ gold: game.gold, n: inv.count('hpM') }));
  const r1 = await ev(A, async () => { net.fail = (m, p) => p === '/api/auction/list'; const it = inv.items.find(x => x.key === 'hpM'); try { await sxAuctionList(it, 5, 300, 24); return 'ok'; } catch (e) { return e.message; } finally { net.fail = null; } });
  const mid = await ev(A, () => ({ gold: game.gold, n: inv.count('hpM'), pend: save.data.svcPend.length }));
  ok(/稍后自动重试/.test(r1) && mid.pend === 1 && mid.n === before.n - 5 && mid.gold === before.gold - 10, '网络错误：物品 / 保管费已扣，记一条待办', { r1, mid });
  await ev(A, () => bus.emit('sceneEnter', { id: world.S.id, kind: 'town' })); await wait(1200);
  const after = await ev(A, () => ({ pend: save.data.svcPend.length, n: inv.count('hpM') }));
  const mine = await H.api('alice', 'GET', '/api/auction/mine');
  ok(after.pend === 0 && mine.on.length === 1 && mine.on[0].n === 5, '进城自动对账：挂单补上，待办清空', { after, on: mine.on.length });
  const r2 = await ev(B, async () => { const a = { id: 999999, price: 100, name: 'x' }; const g = game.gold; try { await sxAuctionBuy(a); } catch (e) { return { msg: e.message, back: game.gold === g, pend: save.data.svcPend.length }; } return 'ok?'; });
  ok(r2.back && r2.pend === 0, '服务端明确拒绝（买不存在的东西）：金币原样退回', r2);

  step('签到');
  const gs = await ev(A, () => { menus.closeAll(); return game.gold; });
  await A.page.click('#sxbar button:has-text("签到")'); await wait(900);
  await shot(A, '07-signin');
  await A.page.click('.sxsign button.big'); await wait(1800);
  const sg = await ev(A, () => ({ gold: game.gold, signed: SX.signed, pend: save.data.svcPend.length }));
  ok(sg.gold === gs + 3000 && sg.signed && sg.pend === 0, '签到成功，奖励 3000 G 自动领取', { d: sg.gold - gs, ...sg });
  await shot(A, '08-signed');

  step('排行榜');
  await ev(A, () => { game.lvl = 15; sxRankReport(); }); await ev(B, () => { game.lvl = 12; sxRankReport(); }); await wait(600);
  await ev(A, () => menus.closeAll()); await A.page.click('#sxbar button:has-text("排行榜")'); await wait(900);
  const rk = await A.page.locator('.sxrank tbody tr').allTextContents();
  ok(rk.length === 2 && rk[0].includes('爱丽丝') && rk[1].includes('鲍勃'), '等级榜：爱丽丝 Lv15 在鲍勃前面', rk);
  await shot(A, '09-rank');
  await A.page.click('.sxrank .itab:has-text("通关时间")'); await wait(800);
  ok(await A.page.locator('.sxrank select').count() === 2, '通关时间榜有地下城 / 难度选择');

  step('全服公告：alice 强化 +12 → bob 屏幕上方滚动公告');
  await ev(A, () => { const it = makeItem('katana_10_2'); it.enh = 12; bus.emit('enhance', { item: it, ok: true, lvl: 12 }); bus.emit('announce', { kind: 'enhance', item: it, lvl: 12 }); });
  await wait(600);
  const bmsg = await relay(B);
  ok(bmsg.filter(m => m.t === 'notice:show').length === 1, '去重：监听 + 主动发 同一件物品只广播一次', bmsg.map(m => m.t));
  await wait(400);
  const nt = await ev(B, () => { const n = document.getElementById('sxnotice'); return n && !n.hidden ? n.textContent : null; });
  ok(nt && nt.includes('爱丽丝') && nt.includes('+12'), 'bob 看到公告条', nt);
  await wait(1500); await shot(B, '10-notice');

  step('管理员后台');
  await B.ctx.close();
  const G = await openPlayer('gm');
  const gbar = await ev(G, () => [...document.querySelectorAll('#sxbar button')].filter(x => !x.hidden).map(x => x.textContent));
  ok(gbar.some(t => t.includes('管理')), '管理员能看到“管理”按钮', gbar);
  await G.page.click('#sxbar button:has-text("管理")'); await wait(800);
  await G.page.fill('.sxgm input[placeholder^="用户名"]', 'alice');
  await G.page.fill('.sxgm input[placeholder="邮件标题"]', '测试补偿');
  await G.page.fill('.sxgm input[placeholder="0"] >> nth=0', '12345');
  await G.page.fill('.sxgm input[placeholder^="搜索物品"]', '抗疲劳'); await wait(300);
  await G.page.click('.sxgm .gres .r >> nth=0'); await wait(300);
  await shot(G, '11-gm');
  await G.page.click('.sxgm button:has-text("发放")'); await wait(300);
  await G.page.click('.idlg button:has-text("发放")'); await wait(900);
  await relay(A);
  const am = (await H.api('alice', 'GET', '/api/mail')).list.find(m => m.kind === 'gm');
  ok(am && am.gold === 12345 && am.items[0].key === 'fatigue', 'alice 收到管理员邮件（12345 G + 抗疲劳秘药）', am);
  for (const tab of ['邀请码', '在线玩家', '日志', '拍卖行']) { await G.page.click(`.sxgm .itab:has-text("${tab}")`); await wait(700); }
  const logRows = await G.page.locator('.sxgm tbody tr').count();
  ok(logRows >= 1, '拍卖行管理页有记录', logRows);
  await G.page.click('.sxgm .itab:has-text("日志")'); await wait(700);
  await shot(G, '12-gm-logs');
  await G.page.click('.sxgm .itab:has-text("全服公告")'); await wait(300);
  await G.page.fill('.sxgm textarea', '今晚 8 点维护'); await G.page.click('.sxgm button:has-text("发布")'); await wait(600);
  const an = await relay(A);
  ok(an.some(m => m.t === 'notice:show' && m.kind === 'custom'), '管理员公告广播到 alice', an.map(m => m.kind));
  await G.ctx.close();

  step('未登录（单机）：全部隐藏');
  const O = await openPlayer('offline');
  const off = await ev(O, () => { const b = document.getElementById('sxbar'); return { bar: !b || b.hidden, svc: NPC_SERVICES.auction.show() }; });
  ok(off.bar && !off.svc, '按钮条隐藏，诺顿的拍卖行按钮不显示', off);
  await O.page.keyboard.press('KeyB'); await wait(300);
  ok(!(await ev(O, () => menus.isOpen('auction'))) && await ev(O, () => toastList.some(t => t.msg.includes('登录后可用'))), '按 B：提示“登录后可用”，不打开窗口');
  await ev(O, () => enterScene('hm_plaza')); await wait(1500);
  await ev(O, () => { const e = world.npcs.find(x => x.npc.id === 'norton'); game.player.x = e.x - 40; game.player.y = e.y; }); await wait(200);
  await O.page.keyboard.press('KeyX'); await wait(600);
  const btns = await O.page.locator('.npcmenu .btn').allTextContents();
  ok(btns.length && !btns.some(t => t.includes('拍卖') || t.includes('邮箱')), '诺顿：没有拍卖行 / 邮箱按钮', btns);
  await O.ctx.close();
  step('登录后：诺顿有拍卖行 / 邮箱');
  await ev(A, () => { menus.closeAll(); return enterScene('hm_plaza'); }); await wait(1500);
  await ev(A, () => { const e = world.npcs.find(x => x.npc.id === 'norton'); game.player.x = e.x - 40; game.player.y = e.y; }); await wait(200);
  await A.page.keyboard.press('KeyX'); await wait(600);
  const btn2 = await A.page.locator('.npcmenu .btn').allTextContents();
  ok(btn2.some(t => t.includes('拍卖行')) && btn2.some(t => t.includes('邮箱')), '诺顿：拍卖行 / 邮箱', btn2);
  await shot(A, '13-norton');
  await A.page.click('.npcmenu .btn:has-text("拍卖行")'); await wait(700);
  ok(await ev(A, () => menus.isOpen('auction')), '点诺顿的拍卖行按钮打开拍卖行');
  await A.ctx.close();
} catch (e) { fail++; console.log('  ✗ 异常', e.stack); }
await browser.close();
await H.close();
const errs = logs.filter(l => l.type === 'pageerror' || l.type === 'console');
ok(!errs.length, '页面没有报错', errs.slice(0, 5));
console.log(`\n${pass} 项通过，${fail} 项失败`);
process.exit(fail ? 1 : 0);
