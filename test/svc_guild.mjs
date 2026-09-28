// 公会 + 成就 端到端测试：本机真实服务端 + 临时数据库，1 个 Chrome 里同时最多 2 个玩家（alice / bob），全部走真实界面
// 公会：创建（扣金币）→ 申请 → 审批 → 名牌标签 → 公会频道 → 贡献 → 公会技能加属性 → 公会商店 → 公告 / 留言 → 成员列表组队邀请 → 玩家菜单邀请 → 排行
// 成就：达成弹窗、成就窗口、领奖（点券 + 物品 + 称号）、商城旧成就不重复发奖、金色成就全服公告、成就点进排行榜、单机也能用
import { startHost } from './svc_host.mjs';
import { launchPlayers, uiLogin, uiCreateChar, until, sleep, dumpErrors } from './net_lib.mjs';
import fs from 'fs';
const out = 'test/shots/guild'; fs.mkdirSync(out, { recursive: true });
const H = await startHost({ admins: ['gm'], ws: false, friends: [['alice', 'bob']] });
const { browser, players, close } = await launchPlayers(2);
let pass = 0, fail = 0;
const ok = (c, msg, extra) => { if (c) { pass++; console.log('  ✓', msg); } else { fail++; console.log('  ✗', msg, extra !== undefined ? JSON.stringify(extra) : ''); } return !!c; };
const step = s => console.log('·', s);
const all = [...players];
const shot = (P, n) => P.page.screenshot({ path: `${out}/${n}.png` });
const ev = (P, fn, arg) => P.page.evaluate(fn, arg);
const closeWins = P => ev(P, () => menus.closeAll());
async function enter(P, who, name, cls = 0) {
  if (!await uiLogin(P.page, H.url, who)) throw new Error(`${who} 登录失败`);
  if (!await uiCreateChar(P.page, cls, name)) throw new Error(`${who} 建角色失败`);
  await until(P.page, () => cloudSave.checked && socialOn() && GD.data !== undefined, null, 10000);
  await closeWins(P);
}
const uid = n => H.users.find(u => u.name === n).id;
try {
  const [A, B] = players;
  step('登录、建角色');
  await enter(A, 'alice', '爱丽丝', 0); await enter(B, 'bob', '鲍勃', 1);

  step('公会：创建（名字 + 徽章，扣金币）');
  await ev(A, () => { game.lvl = 12; game.gold = 80000; save.write(); });
  await A.page.keyboard.press('KeyJ');
  ok(await until(A.page, () => menus.isOpen('guild') && document.querySelector('.sxguild .itab')), '按 J 打开公会窗口');
  await A.page.click('.sxguild .itab:has-text("创建公会")'); await sleep(300);
  await A.page.fill('.sxguild input[placeholder^="2~8"]', '破晓之光');
  await A.page.click('.sxguild .bpick .o >> nth=4'); await sleep(150);         // 形状：星
  await A.page.click('.sxguild .bpick:nth-of-type(2) .o >> nth=2', { timeout: 1500 }).catch(() => {});
  await A.page.click('.sxguild .bpick .gl:has-text("晓")'); await sleep(200);
  await shot(A, '01-create');
  await A.page.click('.sxguild button:has-text("创建")'); await A.page.click('.idlg button:has-text("创建")');
  ok(await until(A.page, () => GD.data && GD.data.guild && GD.data.guild.name === '破晓之光', null, 10000), '公会创建成功');
  const g0 = await ev(A, () => ({ gold: game.gold, pend: save.data.svcPend.length, role: GD.data.me.role, badge: GD.data.guild.badge }));
  ok(g0.gold === 30000 && g0.pend === 0 && g0.role === 'leader' && g0.badge.g === '晓', '扣 50000 金币，会长，徽章“晓”', g0);
  await until(A.page, () => document.querySelector('.sxguild .ghead')); await sleep(200);
  await shot(A, '02-info');

  step('申请 → 审批');
  await B.page.keyboard.press('KeyJ'); await until(B.page, () => document.querySelector('.sxguild .glist .gi'));
  await B.page.click('.sxguild .glist button:has-text("申请")'); await until(B.page, () => menus.isOpen('ask'));
  await B.page.fill('.askwin input', '一起刷深渊！'); await B.page.click('.askwin button:has-text("申请")');
  ok(await until(A.page, () => GD.data && GD.data.reqs && GD.data.reqs.length === 1), '会长收到申请（推送刷新）');
  const dot = await ev(A, () => { sxbar.t = 0; ui.draw(); const b = sxbar.btns.guild; return { hot: b.classList.contains('hot'), n: b._badge.textContent, shown: !b._badge.hidden }; });
  ok(dot.hot && dot.shown && dot.n === '1', '公会按钮亮起并显示 1 个申请', dot);
  await A.page.click('.sxguild .itab:has-text("成员")'); await until(A.page, () => document.querySelector('.sxguild button:has-text("批准")'));
  await shot(A, '03-apply');
  await A.page.click('.sxguild button:has-text("批准")');
  ok(await until(B.page, () => GD.data && GD.data.guild && GD.data.guild.name === '破晓之光'), 'bob 加入公会');
  ok(await until(B.page, id => netPlayerTag(id) === '破晓之光', uid('alice')) && await until(A.page, id => netPlayerTag(id) === '破晓之光', uid('bob')), '名牌标签：互相看到对方的公会名（netPlayerTag）');

  step('名牌：同一个场景里看到对方头顶的公会名');
  await ev(A, () => enterScene('hm_plaza')); await ev(B, () => enterScene('hm_plaza'));
  await until(A.page, id => netTown.peers.has(id) && netTown.peers.get(id).model, uid('bob'), 15000);
  await ev(A, id => { const P = netTown.peers.get(id); game.player.x = P.x - 60; game.player.y = P.y; }, uid('bob')); await sleep(1200);
  await closeWins(A); await shot(A, '04-nameplate');
  ok(true, '截图：04-nameplate.png（名牌第二行“<破晓之光> 神枪手”）');

  step('公会频道');
  await ev(B, () => { chat.setCh('guild'); chat.sendText('大家好，我是鲍勃'); });
  ok(await until(A.page, () => [...document.querySelectorAll('#chatbox .chatline')].some(l => l.textContent.includes('[公会]') && l.textContent.includes('大家好，我是鲍勃'))), 'alice 在聊天框看到 [公会] 消息');
  const cyc = await ev(A, () => { chat.setCh('party'); chat.cycle(); return chat.ch; });
  ok(cyc === 'guild', 'Tab 切频道：队伍 → 公会', cyc);

  step('贡献、升级与公会技能');
  await ev(B, () => bus.emit('dungeonClear', { id: 'lorien', diff: 0, rank: 'A', time: 90, hurt: 3, maxCombo: 10 }));
  ok(await until(B.page, () => GD.data.me && GD.data.me.contrib === 10), 'bob 通关地下城：个人贡献 +10');
  const s0 = await ev(A, () => game.player.str);
  H.ctx.db.run("UPDATE guild SET exp = 995 WHERE name = '破晓之光'");
  await ev(A, () => bus.emit('dungeonClear', { id: 'lorien', diff: 0, rank: 'A', time: 90, hurt: 3, maxCombo: 10 }));
  ok(await until(A.page, () => GD.data.guild.lvl === 2), '公会升到 Lv.2（全服公告 + 公会频道）');
  ok(await until(A.page, s => game.player.str === s + 5, s0), `公会技能「公会之力 I」：力量 +5（${s0} → ${await ev(A, () => game.player.str)}）`);
  ok(await until(B.page, () => [...document.querySelectorAll('#chatbox .chatline')].some(l => l.textContent.includes('Lv.2'))), 'bob 在公会频道看到升级消息');
  await A.page.click('.sxguild .itab:has-text("概况")', { timeout: 1500 }).catch(() => {});
  await A.page.keyboard.press('KeyJ').catch(() => {}); await sleep(200);
  if (!await ev(A, () => menus.isOpen('guild'))) await A.page.keyboard.press('KeyJ');
  await until(A.page, () => document.querySelector('.sxguild .perk.on')); await sleep(200);
  await shot(A, '05-perks');

  step('公告 / 留言板');
  await ev(A, () => { SXGD.tab = 'info'; menus.wins.guild._render(); });
  await A.page.click('.sxguild button:has-text("修改公告")'); await A.page.fill('.idlg textarea', '每晚 8 点集合打深渊！'); await A.page.click('.idlg button:has-text("保存")');
  ok(await until(B.page, () => GD.data.guild.notice === '每晚 8 点集合打深渊！'), 'bob 看到新公告');
  await ev(B, () => { SXGD.tab = 'board'; if (menus.isOpen('guild')) menus.wins.guild._render(); else menus.show('guild'); });
  await until(B.page, () => document.querySelector('.sxguild input[placeholder^="写点什么"]'));
  await B.page.fill('.sxguild input[placeholder^="写点什么"]', '收到，准时上线'); await B.page.click('.sxguild button:has-text("留言")');
  ok(await until(A.page, () => GD.data.posts.some(p => p.text === '收到，准时上线')), 'alice 看到留言');
  await sleep(300); await shot(B, '06-board');

  step('公会商店');
  H.ctx.db.run(`UPDATE guild_member SET contrib = 500 WHERE user_id = ${uid('bob')}`);
  await ev(B, () => { SXGD.tab = 'shop'; return guildRefresh(); });
  await until(B.page, () => document.querySelector('.sxguild .sitem button'));
  const f0 = await ev(B, () => inv.count('fatigue'));
  await B.page.click('.sxguild .sitem:has-text("抗疲劳秘药") button'); await B.page.click('.idlg button:has-text("兑换")');
  ok(await until(B.page, f => inv.count('fatigue') === f + 1 && GD.data.me.contrib === 440 && !(save.data.svcPend || []).length, f0), '兑换抗疲劳秘药：背包 +1，贡献 500 → 440');
  await sleep(300); await shot(B, '07-shop');
  const lock = await ev(B, () => [...document.querySelectorAll('.sxguild .sitem.lock')].length);
  ok(lock >= 5, `公会等级不够的商品是灰的（${lock} 件）`);

  step('成员列表：在线状态、位置、一键组队');
  await ev(A, () => { SXGD.tab = 'members'; menus.wins.guild._render(); return guildRefresh(); });
  await until(A.page, () => document.querySelector('.sxguild tbody tr'));
  const mem = await A.page.locator('.sxguild tbody tr').allTextContents();
  ok(mem.length === 2 && mem.some(t => t.includes('鲍勃') && t.includes('中央广场')), '成员列表：鲍勃在线，位于中央广场', mem);
  await shot(A, '08-members');
  await A.page.click('.sxguild tbody tr:has-text("鲍勃") button:has-text("组队")');
  ok(await until(B.page, () => [...document.querySelectorAll('#chatbox .chatline')].some(l => l.textContent.includes('邀请你组队'))), 'bob 收到组队邀请');
  await until(B.page, () => [...document.querySelectorAll('button')].some(b => b.textContent === '加入队伍'));
  await B.page.click('button:has-text("加入队伍")');
  ok(await until(A.page, () => netParty.p && netParty.p.members.length === 2), '组队成功');
  const pm = await ev(A, () => { menus.close('pmenu'); menus.open('pmenu', { id: 99999, name: 'someone', char: { name: '路人', cls: 'sword', lvl: 5 } }); const t = menus.wins.pmenu ? menus.wins.pmenu.textContent : ''; menus.close('pmenu'); return t; });
  ok(pm.includes('邀请加入公会'), '玩家菜单：会长多了“邀请加入公会”', pm);

  step('排行榜：公会 / 成就点');
  await ev(A, () => { menus.closeAll(); SXR.board = 'guild'; menus.show('rank'); });
  ok(await until(A.page, () => [...document.querySelectorAll('.sxrank tbody tr')].some(r => r.textContent.includes('破晓之光'))), '排行榜“公会”页签');
  await shot(A, '09-guild-rank');

  step('成就：达成弹窗、领奖、点券、称号');
  await closeWins(A);
  const ach0 = await ev(A, () => ({ done: Object.keys(achData().done), cera: save.acct.cera || 0 }));
  ok(ach0.done.includes('guildLead') && ach0.done.includes('guildJoin'), '社交成就：创建公会 / 加入公会', ach0.done);
  // 百战勇士（商城旧成就 kill500，200 点券）：不管是商城的兜底先发，还是本系统领取，合计只能拿到一次 200
  await ev(A, () => { for (let i = 0; i < 500; i++) bus.emit('kill', { kind: 'goblin', lvl: 1, dungeon: 'lorien' }); });
  ok(await until(A.page, () => !!document.querySelector('#achpop .p')), '击杀 500：弹出成就提示');
  const popTxt = await ev(A, () => document.querySelector('#achpop').textContent);
  ok(popTxt.includes('百战勇士'), `弹窗内容：${popTxt}`);
  await sleep(500); await shot(A, '10-popup');
  const k = await ev(A, () => { const d = achData(); if (!d.got.kill500) achClaim('kill500'); return { shop: !!(save.data.shop.ach || {}).kill500, got: !!d.got.kill500 }; });
  await sleep(300);
  const k2 = await ev(A, () => { achClaim('kill500'); achCheck(); return save.acct.cera || 0; });
  ok(k.shop && k.got && k2 - ach0.cera === 200, `“百战勇士”的 200 点券只发了一次（${ach0.cera} → ${k2}）`, k);
  // 本系统自己的成就：击败 10 次领主 → 窗口里领取
  await ev(A, () => { for (let i = 0; i < 10; i++) bus.emit('kill', { kind: 'goblinChief', lvl: 3, boss: true, dungeon: 'lorien' }); });
  await until(A.page, () => achData().done.boss10);
  await A.page.keyboard.press('KeyU'); await until(A.page, () => document.querySelector('.achw .ovtop'));
  await shot(A, '11-ach-overview');
  await A.page.click('.achw .acat:has-text("战斗")'); await until(A.page, () => document.querySelector('.achw .arow.claim'));
  await shot(A, '12-ach-fight');
  const beforeClaim = await ev(A, () => save.acct.cera || 0), rw = await ev(A, () => ACHIEVEMENTS.boss10.reward.cera);
  await A.page.click('.achw .arow.claim:has-text("领主猎手") button:has-text("领取")');
  ok(await until(A.page, ([c, r]) => (save.acct.cera || 0) === c + r, [beforeClaim, rw]), `领取“领主猎手”：点券 +${rw}`);
  const again = await ev(A, () => achClaim('boss10'));
  ok(again.err, '不能重复领取', again);
  // 称号奖励：成就点达到 2000 → 称号「成就大师」
  const tt = await ev(A, () => {
    const d = achData(), skip = ['pts500', 'pts1000', 'pts2000', 'lvl30', 'sss'];
    for (const A of Object.values(ACHIEVEMENTS).filter(a => a.tier >= 2 && !a.online && !skip.includes(a.id)).sort((a, b) => b.tier - a.tier)) { if (achPoints() >= 2000) break; d.done[A.id] ||= Date.now(); }
    achCheck(); const r = achClaim('pts2000'); return { r, has: inv.items.some(x => x.key === 'title_ach_master'), pts: achPoints(), done: !!d.done.pts2000 };
  });
  ok(tt.done && tt.pts >= 2000 && tt.r.ok && tt.has, `成就点 ${tt.pts} ≥ 2000：达成“成就大师”，领取称号「成就大师」`, tt);
  // 商城旧成就：已经在商城领过点券的，读档后直接算已领奖
  const mig = await ev(A, () => { save.data.shop.ach.sss = Date.now() - 86400000; const c = save.acct.cera; achCheck(); const d = achData(); return { done: !!d.done.sss, got: !!d.got.sss, cera: save.acct.cera === c }; });
  ok(mig.done && mig.got && mig.cera, '商城旧成就 sss 已领过：直接算达成且已领奖，不再发点券', mig);

  step('金色成就全服公告、成就点排行');
  await ev(A, () => { game.lvl = 30; bus.emit('levelUp', { lvl: 30 }); });
  ok(await until(B.page, () => { const n = document.getElementById('sxnotice'); return n && n.textContent.includes('传奇勇士'); }, null, 15000), 'bob 看到“达成了金色成就 [传奇勇士]”公告');
  await ev(A, () => sxRankReport());
  await ev(A, () => { menus.closeAll(); SXR.board = 'ach'; menus.show('rank'); });
  ok(await until(A.page, () => [...document.querySelectorAll('.sxrank tbody tr')].some(r => r.textContent.includes('爱丽丝') && r.textContent.includes('点'))), '排行榜“成就点”页签有爱丽丝');
  await shot(A, '13-ach-rank');
  const saved = await ev(A, () => JSON.parse(localStorage.getItem(save.key)).chars[0].ach.done.kill500 > 0);
  ok(saved, '成就数据写进角色存档（随云存档同步）');

  step('单机（不登录）：成就照常可用，公会隐藏');
  await B.ctx.close();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const O = { ctx, page: await ctx.newPage(), logs: [], i: 2 }; all.push(O);
  O.page.on('pageerror', e => O.logs.push({ type: 'pageerror', text: e.message }));
  await O.page.goto(H.url + '?town&cls=gun&mute&offline'); await O.page.waitForFunction(() => window.__READY && game.scene === 'town');
  await closeWins(O);
  await ev(O, () => { for (let i = 0; i < 500; i++) bus.emit('kill', { kind: 'goblin', lvl: 1 }); });
  ok(await until(O.page, () => achData().done.kill500), '单机也能达成成就');
  await O.page.keyboard.press('KeyU'); ok(await until(O.page, () => menus.isOpen('achieve')), '单机按 U 打开成就窗口');
  await closeWins(O); await O.page.keyboard.press('KeyJ'); await sleep(300);
  ok(!(await ev(O, () => menus.isOpen('guild'))) && await ev(O, () => toastList.some(t => t.msg.includes('登录后可用'))), '单机按 J：提示“公会：登录后可用”');
  ok(await ev(O, () => netPlayerTag(1) === null && !guildPerkStats()), '单机没有公会加成');
} catch (e) { fail++; console.log('  ✗ 异常', e.stack); }
const errs = dumpErrors(all);
ok(!errs.length, '页面没有报错', errs.slice(0, 5));
await close();
await H.close();
console.log(`\n${pass} 项通过，${fail} 项失败`);
process.exit(fail ? 1 : 0);
