// 查看其他玩家：alice 穿 +12 史诗（套装 / 增幅 / 锻造 / 附魔）+ 称号 + 时装 / 武器装扮 / 光环 / 宠物 / 宠物装备，建公会（Lv5 有公会技能）
// → bob 从好友列表点「查看」：装备页（强化、提示）、时装页（宠物 / 光环 / 武器装扮）、属性表和评分和 alice 自己的 M 窗口完全一致
// → 接口不返回金币 / 背包 / 仓库 / 金库 / 点券等；bob 自己的状态没被改动；城镇玩家菜单、排行榜（按 cid）也能打开
// 另外：自己的 M 窗口时装页有宠物、宠物装备、光环、武器装扮格子
import fs from 'node:fs';
import { startServer, launchPlayers, ok, result, sleep, until, uiRegister, uiCreateChar, dumpErrors } from './net_lib.mjs';
const out = 'test/shots/inspect'; fs.mkdirSync(out, { recursive: true });
const srv = await startServer();
const { players, close } = await launchPlayers(2, { width: 1440, height: 900 });
const [A, B] = players.map(p => p.page);
const winShot = async (P, name, file) => { const box = await P.evaluate(n => { const r = menus.wins[n].getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }, name); await P.screenshot({ path: `${out}/${file}`, clip: box }); };
// 窗口里的属性表 / 评分 / 名字（按显示的文字比，自己的 M 和查看别人必须一模一样）
const panelText = (P, n) => P.evaluate(n => { const w = menus.wins[n]; return { tbl: [...w.querySelectorAll('.sttbl b')].map(b => b.textContent), score: w.querySelector('.stscore b').textContent, name: w.querySelector('.stname').textContent, sets: w.querySelector('.stsets').textContent }; }, n);
try {
  ok(await uiRegister(A, srv.url, 'alice'), 'alice 注册');
  ok(await uiCreateChar(A, 0, '阿丽剑士'), 'alice 建角色');
  ok(await uiRegister(B, srv.url, 'bob'), 'bob 注册');
  ok(await uiCreateChar(B, 1, '小鲍枪手'), 'bob 建角色');
  // alice：满级 + 一身 +12 史诗
  const gear = await A.evaluate(async () => {
    const p = game.player, cls = p.cls;
    game.lvl = 60; game.gold = 5e6;
    const setId = Object.keys(SETS).find(id => SETS[id].epic && SETS[id].pieces.length >= 3 && SETS[id].pieces.every(k => ITEMS[k] && ITEMS[k].slot !== 'weapon' && ITEMS[k].lvl <= 60));
    const eq = {};
    for (const k of SETS[setId].pieces) { const it = makeItem(k, 1, { enh: 12 }); if (!eq[it.slot]) eq[it.slot] = it; }
    const wk = Object.keys(ITEMS).find(k => { const D = ITEMS[k]; return D.kind === 'equip' && D.rar === 5 && D.slot === 'weapon' && D.cls === cls && D.lvl <= 60; });
    eq.weapon = makeItem(wk, 1, { enh: 12 }); eq.weapon.forge = 5;
    eq.weapon.orb = { key: 'orb_weapon2', st: { ...ITEMS.orb_weapon2.orb.st }, name: ITEMS.orb_weapon2.name };
    for (const s of ['head', 'top', 'bottom', 'belt', 'shoes', 'neck', 'bracelet', 'ring', 'support', 'stone']) if (!eq[s]) {
      const k = Object.keys(ITEMS).find(k => { const D = ITEMS[k]; return D.kind === 'equip' && D.rar === 5 && D.slot === s && D.lvl <= 60 && !D.set; }) || Object.keys(ITEMS).find(k => ITEMS[k].kind === 'equip' && ITEMS[k].rar === 5 && ITEMS[k].slot === s && ITEMS[k].lvl <= 60);
      if (k) eq[s] = makeItem(k, 1, { enh: 12 });
    }
    const amp = eq.top || eq.head; amp.dim = 'str';   // 一件增幅（红字）
    const tk = Object.keys(ITEMS).find(k => ITEMS[k].slot === 'title'); if (tk) eq.title = makeItem(tk);
    for (const k of ['av_weapon_holywing', 'pet_lion', 'petR_2', 'petB_2', 'petG_2']) { const it = makeItem(k); eq[it.slot] = it; }
    const ak = Object.keys(ITEMS).find(k => ITEMS[k].slot === 'av_aura'); eq.av_aura = makeItem(ak);
    const avk = Object.keys(ITEMS).filter(k => ITEMS[k].kind === 'equip' && ['av_top', 'av_hat'].includes(ITEMS[k].slot) && !ITEMS[k].cls).slice(0, 8);
    for (const k of avk) if (!eq[ITEMS[k].slot]) eq[ITEMS[k].slot] = makeItem(k);
    eq.av_pet.orb = { key: 'orb_pet1', st: { ...ITEMS.orb_pet1.orb.st }, name: ITEMS.orb_pet1.name };
    Object.assign(inv.equip, eq);
    for (const s in eq) codexRecord(eq[s], '测试');
    await guildCreate('破晓测试团', { s: 1, c: 2, g: '晓' });
    save.write(); recalcStats(p);
    return { setId, slots: Object.keys(eq), weapon: eq.weapon.name, gold: game.gold };
  });
  ok(gear.slots.length >= 20 && gear.setId, `alice 穿上 ${gear.slots.length} 件（套装 ${gear.setId}，武器 ${gear.weapon}）`, gear);
  srv.app.ctx.db.run('UPDATE guild SET lvl = 5');   // 公会 Lv5：公会技能（四维 / HP MP / 金币）也要算进属性
  await A.evaluate(async () => { await guildRefresh(); recalcStats(game.player); save.write(); await cloudSave.flush(); });
  // alice 自己的 M 窗口
  await A.evaluate(() => { IW.dollPage = 'gear'; menus.open('status'); });
  const self = await panelText(A, 'status');
  await A.evaluate(() => { IW.dollPage = 'avatar'; menus.wins.status._render(); });
  await sleep(700);
  const selfAv = await A.evaluate(() => { const w = menus.wins.status; return { n: w.querySelectorAll('.doll .islot').length, filled: [...w.querySelectorAll('.doll .islot:not(.empty)')].length, pet: !!w.querySelector('.doll canvas.stpet'), slots: ['av_pet', 'av_petR', 'av_petB', 'av_petG', 'av_aura', 'av_weapon'].filter(s => inv.equip[s]).length }; });
  ok(selfAv.n === 14 && selfAv.slots === 6, `自己的 M 时装页：14 格（8 时装 + 武器装扮 + 光环 + 宠物 + 3 件宠物装备）`, selfAv);
  ok(selfAv.pet, '自己的 M 时装页：角色脚边画出宠物 / 光环');
  await winShot(A, 'status', '01-self-avatar.png');
  await A.evaluate(() => { IW.dollPage = 'gear'; menus.close('status'); });
  // 好友
  await A.evaluate(() => netFriends.add('bob')); await sleep(300);
  await B.evaluate(() => netFriends.accept('alice'));
  ok(await until(B, () => { netFriends.load(); return netFriends.isFriend(1); }, null, 6000), '成为好友');
  // 接口：只有公开字段
  const raw = await B.evaluate(() => net.api('GET', '/api/inspect/1'));
  const bad = ['gold', 'inv', 'storage', 'bank', 'acct', 'cera', 'mail', 'quests', 'sp', 'skillLv', 'exp', 'fatigue', 'coins', 'opts', 'chars'];
  const flat = JSON.stringify(raw);
  ok(raw.char && raw.char.name === '阿丽剑士' && raw.char.lvl === 60 && raw.guild && raw.guild.name === '破晓测试团', '接口：角色名 / 等级 / 公会', { char: raw.char, guild: raw.guild && raw.guild.name });
  ok(!bad.some(k => k in raw || k in raw.char) && !/"gold"|"cera"|"storage"|"bank"|"inv"/.test(flat), '接口不返回金币 / 点券 / 背包 / 仓库 / 金库等', Object.keys(raw));
  const fields = new Set(Object.values(raw.equip).flatMap(it => Object.keys(it)));
  ok([...fields].every(k => ['kind', 'name', 'key', 'slot', 'wtype', 'atype', 'cls', 'set', 'dim', 'skin', 'avSet', 'bind', 'rar', 'lvl', 'grade', 'enh', 'dur', 'durMax', 'forge', 'st', 'fx', 'orb', 'legacy'].includes(k)), '接口：装备只有白名单字段', [...fields]);
  ok(raw.equip.weapon && raw.equip.weapon.enh === 12 && raw.equip.weapon.forge === 5 && raw.equip.weapon.orb, '接口：武器 +12 / 锻造 / 附魔都在');
  // bob 从好友列表点「查看」
  const bobBefore = await B.evaluate(() => JSON.stringify({ lvl: game.lvl, job: game.job, eq: Object.keys(inv.equip).sort(), items: inv.items.length, name: save.data.name, codex: Object.keys(save.data.codex || {}).length, st: game.player.stats.atk, gd: typeof GD !== 'undefined' && GD.data ? 1 : 0 }));
  await B.evaluate(() => menus.open('friends')); await sleep(400);
  await winShot(B, 'friends', '05-friends.png');
  const clicked = await B.evaluate(() => { const b = [...document.querySelectorAll('[data-win="friends"] .btn')].find(x => x.textContent === '查看'); if (b) b.click(); return !!b; });
  ok(clicked, '好友列表有「查看」按钮');
  ok(await until(B, () => menus.isOpen('inspect') && menus.wins.inspect.querySelector('.doll'), null, 8000), '查看窗口打开并读到数据');
  await B.evaluate(() => menus.close('friends'));
  const ins = await panelText(B, 'inspect');
  ok(ins.score === self.score, `装备评分一致（${self.score}）`, { self: self.score, ins: ins.score });
  ok(JSON.stringify(ins.tbl) === JSON.stringify(self.tbl), '属性表（HP / MP / 攻击 / 四维 / 暴击 / 速度 / 属性强化……）和 alice 自己的 M 窗口完全一致', { self: self.tbl.slice(0, 12), ins: ins.tbl.slice(0, 12) });
  ok(ins.name === self.name && ins.name.includes('<破晓测试团>'), `名字 / 等级 / 职业 / 公会：${ins.name}`, { self: self.name, ins: ins.name });
  ok(ins.sets === self.sets, '套装 / 防具精通 / 城镇移速这一栏一致', { self: self.sets, ins: ins.sets });
  const gearView = await B.evaluate(() => { const w = menus.wins.inspect; return { n: w.querySelectorAll('.doll .islot').length, filled: w.querySelectorAll('.doll .islot:not(.empty)').length, plus12: [...w.querySelectorAll('.doll .islot .e')].filter(e => e.textContent === '+12').length, amp: w.querySelectorAll('.doll .islot .e.amp').length, set: w.querySelectorAll('.doll .islot.seton').length, cv: !!w.querySelector('.doll canvas.avcv'), ttl: (w.querySelector('.doll .ttl') || {}).textContent || '' }; });
  ok(gearView.n === 12 && gearView.filled >= 11 && gearView.plus12 >= 10, `装备页：12 格、${gearView.filled} 件、+12 ×${gearView.plus12}`, gearView);
  ok(gearView.amp === 1 && gearView.set >= 3 && gearView.cv, '增幅红字、套装绿框、角色立绘都有', gearView);
  // 悬停武器：提示里有强化 / 锻造 / 附魔；悬停套装件：套装件数按 alice 的装备算
  const tipW = await B.evaluate(() => { const w = menus.wins.inspect, el = [...w.querySelectorAll('.doll .islot')].find(x => x.style.gridColumn === '3' && x.style.gridRow.startsWith('1')); el.dispatchEvent(new MouseEvent('mousemove', { clientX: 700, clientY: 300, bubbles: true })); const t = document.getElementById('itip'); return t && !t.hidden ? t.textContent : ''; });
  ok(/强化 \+12/.test(tipW) && /锻造 \+5/.test(tipW) && /附魔/.test(tipW) && !/▶ 装备中/.test(tipW), '武器提示：强化 +12、锻造 +5、附魔，没有和自己的装备对比', tipW.slice(0, 160));
  const tipS = await B.evaluate(setId => { const w = menus.wins.inspect, el = w.querySelector(`.doll .islot[data-set="${setId}"]`); el.dispatchEvent(new MouseEvent('mousemove', { clientX: 400, clientY: 300, bubbles: true })); const t = document.getElementById('itip'); return t.textContent; }, gear.setId);
  const nSet = await A.evaluate(id => equippedSetCount(id), gear.setId);
  ok(tipS.includes(`（${nSet}/`), `套装提示：按 alice 身上的件数（${nSet} 件）`, tipS.slice(0, 200));
  await B.evaluate(() => { const w = menus.wins.inspect, el = [...w.querySelectorAll('.doll .islot')].find(x => x.style.gridColumn === '3' && x.style.gridRow.startsWith('1')); el.dispatchEvent(new MouseEvent('mousemove', { clientX: 900, clientY: 200, bubbles: true })); });
  await sleep(200);
  await B.screenshot({ path: `${out}/02-inspect-gear.png` });
  await B.evaluate(() => menus.hideTip());
  // 只读：右键 / 双击不会卸下，也拖不动
  const eqBefore = await B.evaluate(() => { const w = menus.wins.inspect, el = w.querySelector('.doll .islot:not(.empty)'); el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true })); el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); return w.querySelectorAll('.doll .islot:not(.empty)').length; });
  ok(eqBefore === gearView.filled, '只读：右键 / 双击不会卸下');
  // 时装页
  await B.click('[data-win="inspect"] .itab:has-text("时装")'); await sleep(800);
  const avView = await B.evaluate(() => { const w = menus.wins.inspect; const sl = [...w.querySelectorAll('.doll .islot')]; return { n: sl.length, filled: sl.filter(x => !x.classList.contains('empty')).length, pet: !!w.querySelector('.doll canvas.stpet'), imgs: sl.filter(x => x.querySelector('img')).length }; });
  ok(avView.n === 14 && avView.filled >= 8 && avView.pet, `时装页：14 格、${avView.filled} 件，宠物 / 光环画在脚边`, avView);
  const petTip = await B.evaluate(() => { const w = menus.wins.inspect, out = {}; for (const [k, lbl] of [['pet', '宠物'], ['aura', '光环'], ['wpn', '武器装扮']]) { const el = [...w.querySelectorAll('.doll .islot:not(.empty)')].find(x => { x.dispatchEvent(new MouseEvent('mousemove', { clientX: 400, clientY: 300, bubbles: true })); return document.getElementById('itip').textContent.includes(lbl); }); out[k] = el ? document.getElementById('itip').textContent.slice(0, 60) : ''; } return out; });
  ok(petTip.pet && petTip.aura && petTip.wpn, '时装页：宠物、光环、武器装扮都能看到提示', petTip);
  await B.evaluate(() => menus.hideTip());
  await winShot(B, 'inspect', '03-inspect-avatar.png');
  await B.click('[data-win="inspect"] .itab:has-text("装备")'); await sleep(300);
  await winShot(B, 'inspect', '04-inspect-gear-win.png');
  // bob 自己的状态没被动过
  const bobAfter = await B.evaluate(() => JSON.stringify({ lvl: game.lvl, job: game.job, eq: Object.keys(inv.equip).sort(), items: inv.items.length, name: save.data.name, codex: Object.keys(save.data.codex || {}).length, st: game.player.stats.atk, gd: typeof GD !== 'undefined' && GD.data ? 1 : 0 }));
  ok(bobBefore === bobAfter, 'bob 自己的等级 / 装备 / 背包 / 存档 / 属性都没变', { bobBefore, bobAfter });
  await B.evaluate(() => { menus.open('status'); }); await sleep(200);
  const bobM = await panelText(B, 'status');
  ok(bobM.score !== ins.score && bobM.name.includes('小鲍枪手'), 'bob 自己的 M 窗口还是自己的', bobM.name);
  await B.evaluate(() => { menus.close('status'); menus.close('inspect'); });
  // 城镇玩家菜单 → 查看信息
  for (const P of [A, B]) await P.evaluate(() => worldTravel('elvenguard'));
  ok(await until(B, () => netTown.peers.size === 1, null, 10000), '同一个城镇');
  await B.evaluate(() => { const p = [...netTown.peers.values()][0]; netPlayerMenu({ id: p.id, name: p.acct, char: p.char }); });
  await B.click('.pmenu button:has-text("查看信息")');
  ok(await until(B, () => menus.isOpen('inspect') && menus.wins.inspect.querySelector('.stscore'), null, 8000), '城镇玩家菜单「查看信息」打开同一个窗口');
  ok((await panelText(B, 'inspect')).score === self.score, '城镇里查看：评分一致');
  await B.evaluate(() => menus.close('inspect'));
  // 排行榜入口：按 cid（角色创建时间）选角色
  const cid = await A.evaluate(() => String(save.data.created));
  await B.evaluate(c => netInspect({ id: 1, name: 'alice', cid: c, char: { name: '阿丽剑士' } }), cid);
  ok(await until(B, () => menus.isOpen('inspect') && menus.wins.inspect.querySelector('.stscore'), null, 8000), '按 cid 打开（排行榜入口）');
  const bogus = await B.evaluate(() => net.api('GET', '/api/inspect/999').then(() => 'ok', e => e.status));
  ok(bogus === 404, '不存在的玩家：404');
  const errs = dumpErrors(players);
  ok(!errs.length, '没有页面报错', errs.slice(0, 5));
} catch (e) { ok(false, '异常：' + (e.stack || e)); }
finally { await close(); await srv.stop(); }
const { fails, total } = result();
console.log(`\n查看其他玩家：${total - fails}/${total} 通过`);
process.exit(fails ? 1 : 0);
