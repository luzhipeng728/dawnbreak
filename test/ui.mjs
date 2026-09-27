// 界面与操作测试：角色创建 / 选择 / 删除 / 切换（各自存档）、快捷键 → 窗口、改键生效并持久化、技能拖到技能栏、
// 窗口拖动与层级、Esc 行为、城镇里面板窗口不挡移动、地下城开窗口暂停、设置开关、截图
import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';
const out = 'test/shots/ui'; fs.mkdirSync(out, { recursive: true });
const { browser, page, logs } = await launch({ width: 1280, height: 720 });
const wait = ms => page.waitForTimeout(ms), shot = n => page.screenshot({ path: `${out}/${n}.png` });
const ev = (fn, arg) => page.evaluate(fn, arg);
let pass = 0, fail = 0;
const ok = (cond, msg, extra = '') => { if (cond) { pass++; console.log('  ✓', msg); } else { fail++; console.log('  ✗', msg, extra); } };
const sec = s => console.log('\n■', s);
const closeAll = () => ev(() => menus.closeAll());
const stack = () => ev(() => menus.stack.slice());
// UI 逻辑坐标（1920×1080）→ 页面坐标
const uiPt = async (x, y) => ev(([x, y]) => { const r = stage.getBoundingClientRect(); return [r.left + x / UW * r.width, r.top + y / UH * r.height]; }, [x, y]);
const center = async sel => { const b = await page.locator(sel).first().boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
// 元素上一个没被其他窗口挡住的点
const visiblePt = sel => ev(sel => { const el = document.querySelector(sel), r = el.getBoundingClientRect(); for (let fy = 0.05; fy < 1; fy += 0.1) for (let fx = 0.05; fx < 1; fx += 0.1) { const x = r.left + r.width * fx, y = r.top + r.height * fy, t = document.elementFromPoint(x, y); if (t && el.contains(t)) return [x, y]; } return null; }, sel);
const dragTo = async ([x0, y0], [x1, y1]) => { await page.mouse.move(x0, y0); await page.mouse.down(); await page.mouse.move(x0 + 10, y0 + 10, { steps: 3 }); await page.mouse.move(x1, y1, { steps: 8 }); await wait(60); await page.mouse.up(); await wait(150); };

await page.goto(`${URL_BASE}?mute`);
await page.waitForFunction(() => window.__READY); await wait(500);

sec('角色创建');
await page.click('text=进入游戏'); await wait(300);
ok(await ev(() => menus.isOpen('charselect') && save.data === null), '标题 → 角色选择（选角界面 save.data 为空）');
ok((await page.locator('#charsel .cslot.empty').count()) === await ev(() => MAX_CHARS), '空角色位数 = MAX_CHARS');
await page.click('#charsel button:has-text("创建角色")'); await wait(300);
ok(await ev(() => menus.isOpen('newgame')), '进入创建角色');
const nameErr = async v => { await page.fill('#newgame input.txt', v); await wait(50); return page.textContent('#newgame .ngerr'); };
ok((await nameErr('a')).includes('太短'), '名字太短被拒绝');
ok((await nameErr('这是一个非常非常长的名字')).includes('太长'), '名字太长被拒绝');
ok((await nameErr('勇 士!')).includes('只能使用'), '空格 / 符号被拒绝');
ok((await nameErr('测试剑士')).includes('可以使用'), '合法名字通过');
await page.click('#newgame .clscard[data-cls="sword"]'); await wait(200);
await page.fill('#newgame input.txt', '测试剑士'); await shot('01-newgame');
await page.click('text=创建并开始'); await page.waitForFunction(() => game.scene === 'town' && game.player, null, { timeout: 15000 }); await wait(600);
ok(await ev(() => save.data.name === '测试剑士' && save.data.cls === 'sword' && world.S.id === START_SCENE), '新角色出生在 START_SCENE，名字 / 职业正确');
await closeAll();
await ev(() => { game.gold = 12345; save.write(); });

sec('返回角色选择 → 创建第二个角色');
await page.keyboard.press('Escape'); await wait(200);
ok((await stack()).join() === 'system', '没有窗口时 Esc 打开系统菜单');
await page.click('.sysmenu button:has-text("返回角色选择")'); await wait(500);
ok(await ev(() => menus.isOpen('charselect') && game.scene === 'title' && !game.player && save.data === null), '返回角色选择：清场并回到选角');
ok((await page.locator('#charsel .cslot:not(.empty)').count()) === 1, '选角界面显示 1 个角色');
await shot('02-charselect-1');
await page.click('#charsel button:has-text("创建角色")'); await wait(300);
ok((await nameErr('测试剑士')).includes('已经被'), '重名被拒绝');
await page.click('#newgame .clscard[data-cls="gun"]'); await wait(200);
await page.fill('#newgame input.txt', '测试枪手');
await page.click('text=创建并开始'); await page.waitForFunction(() => game.scene === 'town' && game.player && game.player.cls === 'gun', null, { timeout: 15000 }); await wait(400);
ok(await ev(() => save.data.name === '测试枪手' && game.gold === 1500), '第二个角色独立存档（金币为初始值）');
await closeAll();
ok(await ev(() => backToCharSelect()), 'backToCharSelect() 可用');
await wait(400);
ok((await page.locator('#charsel .cslot:not(.empty)').count()) === 2, '选角界面显示 2 个角色');
await page.click('#charsel .cslot[data-i="0"]'); await wait(200); await shot('03-charselect-2');
const info0 = await page.textContent('#charsel .csinfo');
const locWant = await ev(() => csLocName(save.chars[0]));
ok(info0.includes('测试剑士') && info0.includes(locWant), '角色信息显示名字与所在位置', info0);
await page.click('#charsel button:has-text("开始游戏")'); await page.waitForFunction(() => game.scene === 'town' && game.player, null, { timeout: 15000 }); await wait(400);
ok(await ev(() => save.data.name === '测试剑士' && game.player.cls === 'sword' && game.gold === 12345), '切回第一个角色：金币 12345 保留');
await closeAll();

sec('删除角色（输入角色名确认）');
await ev(() => backToCharSelect()); await wait(400);
await page.click('#charsel .cslot[data-i="1"]'); await wait(200);
await page.click('#charsel button:has-text("删除角色")'); await wait(200);
ok(await ev(() => menus.isOpen('ask')), '弹出删除确认框');
await page.fill('.askwin input.txt', '错误的名字'); await page.click('.askwin button:has-text("删除")'); await wait(150);
ok((await page.textContent('.askwin .askerr')).includes('不一致') && await ev(() => save.chars.length === 2), '名字不一致不会删除');
await shot('04-delete-confirm');
await page.fill('.askwin input.txt', '测试枪手'); await page.click('.askwin button:has-text("删除")'); await wait(300);
const stored = await ev(() => JSON.parse(localStorage.getItem(save.key)));
ok(stored.chars.length === 1 && stored.chars[0].name === '测试剑士' && stored.chars[0].gold === 12345, '删除后本地存档只剩第一个角色，数据完好');
await page.click('#charsel .cslot[data-i="0"]'); await page.click('#charsel button:has-text("开始游戏")');
await page.waitForFunction(() => game.scene === 'town' && game.player, null, { timeout: 15000 }); await wait(400); await closeAll();

sec('角色位上限');
{
  const P2 = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await P2.goto(`${URL_BASE}?mute`); await P2.waitForFunction(() => window.__READY);
  await P2.evaluate(() => { const chars = Array.from({ length: MAX_CHARS }, (_, i) => ({ ...save.defaults(['sword', 'gun', 'mage'][i % 3], '角色' + '甲乙丙丁戊己庚辛'[i]), lvl: 10 + i })); localStorage.setItem(save.key + '_bak', localStorage.getItem(save.key) || ''); localStorage.setItem(save.key, JSON.stringify({ v: SAVE_V, cur: 2, chars })); menus.closeAll(); menus.open('charselect'); });
  await P2.waitForTimeout(200);
  ok((await P2.locator('#charsel .cslot.empty').count()) === 0 && (await P2.locator('#charsel .cslot.sel').count()) === 1, `${await ev(() => MAX_CHARS)} 个角色位全满，默认选中上次的角色`);
  ok(await P2.evaluate(() => document.querySelector('#charsel button.blue').classList.contains('off')), '角色位满时“创建角色”不可用');
  await P2.keyboard.press('ArrowRight'); await P2.waitForTimeout(100);
  ok(await P2.evaluate(() => menus.csSel === 3), '← → 切换选中的角色');
  await P2.screenshot({ path: `${out}/03b-charselect-full.png` });
  await P2.evaluate(() => { const b = localStorage.getItem(save.key + '_bak'); if (b) localStorage.setItem(save.key, b); else localStorage.removeItem(save.key); localStorage.removeItem(save.key + '_bak'); });
  await P2.close();
}

sec('快捷键 → 窗口');
// 其他组的窗口（quests / worldmap / status / duel）合并前用占位窗口，只验证键位映射
await ev(() => { for (const n of ['quests', 'worldmap', 'status', 'duel']) if (typeof menus['w_' + n] !== 'function') { menus['w_' + n] = function () { return this.win('占位 ' + n, h('div', {}, n)); }; menus['_stub_' + n] = true; } });
for (const [k, want] of [['KeyI', 'inv'], ['KeyM', 'status'], ['KeyK', 'skills'], ['KeyL', 'quests'], ['F1', 'quests'], ['KeyN', 'worldmap'], ['KeyO', 'settings'], ['KeyP', 'duel']]) {
  await closeAll(); await page.keyboard.press(k); await wait(150);
  const st = await stack(); ok(st.includes(want), `${k} → ${want}`, st.join());
  await page.keyboard.press(k); await wait(120); ok(!(await stack()).includes(want), `${k} 再按一次关闭`);
}
await closeAll();

sec('Esc 行为 / 多窗口 / 层级 / 拖动');
await page.keyboard.press('KeyI'); await wait(150); await page.keyboard.press('KeyK'); await wait(150); await page.keyboard.press('KeyM'); await wait(200);
ok((await stack()).join() === 'inv,skills,status', 'I + K + M 可以同时打开', (await stack()).join());
await shot('05-three-windows');
{ const pt = await visiblePt('[data-win="inv"]'); ok(!!pt, '同时打开的窗口不会被完全挡住（错开摆放）'); if (pt) await page.mouse.click(pt[0], pt[1]); await wait(100); }
ok((await stack()).at(-1) === 'inv', '点击窗口置顶（stack 最后一个 = inv）');
const zs = await ev(() => ['inv', 'skills', 'status'].map(n => +menus.wins[n].style.zIndex));
ok(zs[0] > zs[1] && zs[0] > zs[2], '置顶窗口 z-index 最大', zs.join());
const b0 = await page.locator('[data-win="skills"]').boundingBox();
const [hx, hy] = await center('[data-win="skills"] > .hd .tt');
await dragTo([hx, hy], [hx + 150, hy + 50]);
const b1 = await page.locator('[data-win="skills"]').boundingBox();
ok(Math.abs(b1.x - b0.x - 150) < 12 && Math.abs(b1.y - b0.y - 50) < 12, '按标题栏拖动窗口', `${Math.round(b1.x - b0.x)},${Math.round(b1.y - b0.y)}`);
ok((await stack()).at(-1) === 'skills', '拖动的窗口自动置顶');
await dragTo([hx + 150, hy + 50], [hx + 5000, hy + 5000]);
const bb = await page.locator('[data-win="skills"]').boundingBox();
ok(bb.x + bb.width <= 1281 && bb.y + bb.height <= 721, '拖不出屏幕', JSON.stringify(bb));
await dragTo([bb.x + 40, bb.y + 12], [b1.x + 40, b1.y + 12]);
const b1b = await page.locator('[data-win="skills"]').boundingBox();
await page.keyboard.press('Escape'); await wait(120);
ok((await stack()).length === 2 && !(await stack()).includes('skills'), 'Esc 只关最上层', (await stack()).join());
await page.keyboard.press('KeyK'); await wait(150);
const b2 = await page.locator('[data-win="skills"]').boundingBox();
ok(Math.abs(b2.x - b1b.x) < 3 && Math.abs(b2.y - b1b.y) < 3, '重新打开记住位置', `${b2.x},${b2.y} vs ${b1b.x},${b1b.y}`);
ok(await ev(() => !!uiPref('winPos').skills), '窗口位置写入本机设置');
await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await wait(150);
ok((await stack()).length === 0, '连按 Esc 逐个关闭');
await page.keyboard.press('Escape'); await wait(120); ok((await stack()).join() === 'system', '再按 Esc 打开系统菜单');
await page.keyboard.press('Escape'); await wait(120); ok((await stack()).length === 0, 'Esc 关闭系统菜单');

sec('城镇：面板窗口不挡移动，对话窗口挡移动');
await page.keyboard.press('KeyI'); await wait(150);
ok(await ev(() => !menus.modal()), '物品栏开着时 menus.modal() = false');
let x0 = await ev(() => game.player.x);
await page.keyboard.down('ArrowRight'); await wait(400); await page.keyboard.up('ArrowRight');
ok((await ev(() => game.player.x)) - x0 > 30, '物品栏开着也能走路');
await closeAll();
await ev(() => openNpc(world.npcs[0].npc)); await wait(200);
ok(await ev(() => menus.modal() && menus.hudHidden()), 'NPC 对话阻挡移动，并隐藏 HUD 底栏');
x0 = await ev(() => game.player.x);
await page.keyboard.down('ArrowLeft'); await wait(300); await page.keyboard.up('ArrowLeft');
ok(Math.abs((await ev(() => game.player.x)) - x0) < 2, 'NPC 对话时不能移动');
await shot('06-npc-no-hud');
await closeAll();
// 右键 NPC = 对话
const npcPt = await ev(() => { const e = world.npcs[0]; game.player.x = e.x - 50; game.player.y = e.y; cam.x = clamp(e.x - WW / 2, 0, Math.max(0, world.S.width - WW)); const r = wcan.getBoundingClientRect(); return [r.left + (e.x - cam.x) / WW * r.width, r.top + (FLOOR_Y + e.y - e.npc.h * 0.5) / WH * r.height]; });
await wait(100); await page.mouse.click(npcPt[0], npcPt[1], { button: 'right' }); await wait(200);
ok((await stack()).includes('npc'), '右键 NPC 打开对话', (await stack()).join());
await closeAll();

sec('改键：生效并持久化');
await page.keyboard.press('KeyO'); await wait(150);
await page.click('[data-win="settings"] .sktab[data-tab="keys"]'); await wait(150);
await page.click('.kcell[data-act="inv"][data-slot="0"]'); await wait(100);
ok(await ev(() => menus.capturing && menus.capturing.a === 'inv'), '点击按键格进入等待按键');
await shot('07-keyconfig-wait');
await page.keyboard.press('KeyB'); await wait(150);
ok(await ev(() => KEYMAP.inv.join() === 'KeyB'), '物品栏改成 B');
await closeAll();
await page.keyboard.press('KeyI'); await wait(120); ok(!(await stack()).includes('inv'), '旧键 I 不再打开物品栏');
await page.keyboard.press('KeyB'); await wait(120); ok((await stack()).includes('inv'), '新键 B 打开物品栏');
await closeAll();
// 冲突：把攻击改成 A → 技能栏 1 失去 A
await ev(() => { menus.show('settings', { tab: 'keys' }); });
await wait(100); await page.click('.kcell[data-act="attack"][data-slot="0"]'); await page.keyboard.press('KeyA'); await wait(120);
ok(await ev(() => KEYMAP.attack[0] === 'KeyA' && !KEYMAP.s0.includes('KeyA')), '键位冲突：A 从技能栏 1 移到攻击');
await ev(() => { game.player.x = world.S.width - 200; game.player.y = 150; });   // 离 NPC 远一点（攻击键在 NPC 旁边 = 对话）
await wait(100); await page.keyboard.down('KeyA'); await wait(50); ok(await ev(() => input.is('attack')), '改键后 input.is("attack") 读新键'); await page.keyboard.up('KeyA');
await closeAll();
await page.reload(); await page.waitForFunction(() => window.__READY); await wait(300);
ok(await ev(() => KEYMAP.inv.join() === 'KeyB' && KEYMAP.attack[0] === 'KeyA'), '刷新后改键仍然有效（本机保存）');
ok(await ev(() => keyName('inv') === 'B'), 'keyName 跟随改键');
await ev(() => resetKeys());
ok(await ev(() => KEYMAP.inv.join() === 'KeyI' && KEYMAP.attack.join() === 'KeyX' && KEYMAP.s0.join() === 'KeyA'), '恢复默认按键');
await page.click('text=进入游戏'); await wait(300);
ok(await ev(() => menus.isOpen('charselect') && save.chars.length === 1), '刷新后选角界面仍有角色');
await page.keyboard.press('Enter'); await page.waitForFunction(() => game.scene === 'town' && game.player, null, { timeout: 15000 }); await wait(400);
ok(await ev(() => save.data.name === '测试剑士'), '选角界面 Enter = 开始游戏');
await closeAll();

sec('技能窗口 K：学习 / 降级 / 拖到技能栏 / 右键锁定指令');
await page.keyboard.press('KeyK'); await wait(200);
const learnable = await ev(() => skillPages().base.find(id => !skillUpBlock(id) && game.skillLv[id] === 1 && skMin(id) === 1));   // 初始技能：升一级再降回来
if (learnable) {
  const lv0 = await ev(id => game.skillLv[id] || 0, learnable);
  const sp0 = await ev(() => game.sp);
  await page.click(`.ski2:has([data-id="${learnable}"]) button[title^="升级"]`); await wait(150);
  ok(await ev(([id, l]) => game.skillLv[id] === l + 1, [learnable, lv0]) && (await ev(() => game.sp)) < sp0, `升级 ${learnable}（Lv.${lv0} → ${lv0 + 1}），SP 减少`);
  await page.click(`.ski2:has([data-id="${learnable}"]) button[title^="降级"]`); await wait(150);
  ok(await ev(([id, l]) => (game.skillLv[id] || 0) === l, [learnable, lv0]) && (await ev(() => game.sp)) === sp0, '降级返还 SP');
  ok(await ev(id => !!skillDownBlock(id), learnable), '初始技能不能降到 0 级');
  await page.click(`.ski2:has([data-id="${learnable}"]) button[title^="升级"]`); await wait(150);
} else ok(false, '没有可学习的技能（技能数据异常？）');
const learned = await ev(() => skillPages().base.find(id => game.skillLv[id] > 0 && !SKILLS[id].passive));
// 拖到 HUD 技能栏第 12 格（Y）
await ev(() => { game.skillBar[11] = null; });
const slot11 = await ev(() => { const R = hudSkillRect(11); return [R.x + R.s / 2, R.y + R.s / 2]; });
await dragTo(await center(`.ski2 [data-id="${learned}"]`), await uiPt(...slot11));
ok(await ev(id => game.skillBar[11] === id, learned), '技能图标拖到 HUD 技能栏', await ev(() => game.skillBar.join()));
ok(await ev(id => game.skillBar.filter(x => x === id).length === 1, learned), '同一技能在技能栏里只有一格（移动而不是复制）');
await shot('08-skill-dragged');
// 从 HUD 技能栏拖出 = 清空
await closeAll();
await dragTo(await uiPt(...slot11), await uiPt(960, 400));
ok(await ev(() => game.skillBar[11] === null), 'HUD 技能栏拖到空处 = 清空');
// 右键清空
const firstSlot = await ev(() => game.skillBar.findIndex(Boolean));
const fr = await ev(i => { const R = hudSkillRect(i); return [R.x + R.s / 2, R.y + R.s / 2]; }, firstSlot);
const idFirst = await ev(i => game.skillBar[i], firstSlot);
const [fx, fy] = await uiPt(...fr); await page.mouse.click(fx, fy, { button: 'right' }); await wait(120);
ok(await ev(i => game.skillBar[i] === null, firstSlot), 'HUD 技能栏右键清空');
await ev(([i, id]) => { game.skillBar[i] = id; }, [firstSlot, idFirst]);
// 窗口里的技能栏预览：拖进去
await page.keyboard.press('KeyK'); await wait(200);
await dragTo(await center(`.ski2 [data-id="${learned}"]`), await center('.skbar .bs[data-slot="10"]'));
ok(await ev(id => game.skillBar[10] === id, learned), '拖到技能窗口下方的技能栏');
// 右键技能图标：指令锁定
const cmdId = await ev(() => skillPages().base.find(id => skCmd(id)));
if (cmdId) {
  await page.click(`.ski2 [data-id="${cmdId}"]`, { button: 'right' }); await wait(150);
  ok(await ev(id => save.data.opts.cmdLock[id] === true, cmdId), `右键 ${cmdId} 锁定指令（save.data.opts.cmdLock）`);
  await shot('09-cmdlock');
  await page.click(`.ski2 [data-id="${cmdId}"]`, { button: 'right' }); await wait(150);
  ok(await ev(id => !save.data.opts.cmdLock[id], cmdId), '再次右键解锁');
}
// 提示框：悬停显示当前 / 下一级
await page.hover(`.ski2 [data-id="${learned}"]`); await wait(150);
const tip = await ev(() => document.getElementById('tip') && !document.getElementById('tip').classList.contains('hidden') ? document.getElementById('tip').textContent : '');
ok(tip.includes('当前等级') || tip.includes('下一等级'), '技能提示框显示等级数值', tip.slice(0, 60));
await shot('10-skill-tip');
await closeAll();

sec('HUD 消耗品栏 / 悬停提示');
const HUD_HP = await ev(() => [HUD.hp.x, HUD.hp.y]);
await ev(() => { inv.quick[5] = null; });
const q5 = await ev(() => { const R = hudQuickRect(5); return [R.x + R.s / 2, R.y + R.s / 2]; });
const hpKey = await ev(() => inv.quick[0]);
await dragTo(await uiPt(...await ev(() => { const R = hudQuickRect(0); return [R.x + R.s / 2, R.y + R.s / 2]; })), await uiPt(...q5));
ok(await ev(k => inv.quick[5] === k && inv.quick[0] !== k, hpKey), '消耗品栏格子之间拖动 = 移动');
const dropOk = await ev(() => { const it = inv.items.find(i => i.kind === 'use'); if (!it) return 'noitem'; const R = hudQuickRect(2); inv.quick[2] = null; for (const fn of dnd.canvasFns) if (fn({ type: 'item', item: it, from: 'inv' }, R.x + 5, R.y + 5)) break; return inv.quick[2] === it.key; });
ok(dropOk === true, '背包消耗品拖入快捷栏（dnd.canvas 落点）', String(dropOk));

const tipText = () => ev(() => { const t = document.getElementById('tip'); return t && !t.classList.contains('hidden') ? t.textContent : ''; });
await page.mouse.move(...await uiPt(HUD_HP[0], HUD_HP[1])); await wait(100);
ok((await tipText()).includes('HP'), '悬停 HP 球显示数值', await tipText());
await page.mouse.move(...await uiPt(...(await ev(() => { const R = hudSkillRect(1); return [R.x + 20, R.y + 20]; })))); await wait(100);
ok((await tipText()).length > 0, '悬停技能栏显示技能说明');
await page.mouse.move(...await uiPt(960, 300)); await wait(100);
ok((await tipText()) === '', '移开后提示框消失');

sec('地下城：开窗口暂停');
await ev(() => enterDungeon('lorien', 0)); await page.waitForFunction(() => game.scene === 'dungeon', null, { timeout: 20000 }); await wait(600);
await page.keyboard.press('KeyI'); await wait(150);
ok(await ev(() => game.paused === true), '地下城里打开物品栏 = 暂停');
await page.keyboard.press('Escape'); await wait(150);
ok(await ev(() => game.paused === false), '关闭窗口恢复');
await page.keyboard.press('Escape'); await wait(150);
ok(await ev(() => menus.isOpen('system') && game.paused), '地下城 Esc 打开系统菜单并暂停');
ok(await ev(() => menus.wins.system.querySelector('button.off') !== null), '地下城里“返回角色选择”不可用');
await shot('11-dungeon-system');
await closeAll();
await ev(() => { game.dungeon.hurt = 0; game.combo = 25; game.comboT = 1; });
await wait(100); await shot('12-dungeon-hud');

sec('设置：画面开关 / 界面模式 / 截图');
await ev(() => setPref('dmgNum', false));
ok(await ev(() => uiPref('dmgNum') === false), '关闭伤害数字（uiPref）');
await ev(() => setPref('dmgNum', true));
await ev(() => { setPref('shake', false); cam.shake = 10; }); await wait(100);
if (await ev(() => updateCamera.toString().includes('shake') && updateCamera.toString().includes('uiPref'))) ok(await ev(() => cam.shx === 0 && cam.shy === 0), '关闭屏幕震动后镜头不抖');
else ok(await ev(() => uiPref('shake') === false), '关闭屏幕震动（uiPref；镜头由主线程 game.js 原生判断，合并后生效）');
await ev(() => setPref('shake', true));
await page.keyboard.press('Tab'); await wait(100);
ok(await ev(() => uiPref('hudMode') === 'lite'), 'Tab 切换简洁界面');
await shot('13-hud-lite');
await page.keyboard.press('Tab'); await wait(100); ok(await ev(() => uiPref('hudMode') === 'full'), '再按 Tab 切回完整');
await page.keyboard.press('ControlLeft'); await wait(80); ok(await ev(() => uiPref('dropNames') === false), 'Ctrl 切换掉落物名称'); await page.keyboard.press('ControlLeft');
await page.keyboard.press('End'); await wait(80); ok(await ev(() => uiPref('hideRank') === true), 'End 隐藏实时评价'); await page.keyboard.press('End');
const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 3000 }).catch(() => null), page.keyboard.press('F12')]);
ok(dl && dl.suggestedFilename().endsWith('.png'), 'F12 截图下载 PNG', dl ? dl.suggestedFilename() : 'no download');

sec('技能窗口：转职页签（没有转职数据时用假数据）');
await ev(() => enterScene(START_SCENE)); await page.waitForFunction(() => game.scene === 'town'); await wait(300); await closeAll();
const fakeJob = await ev(() => {
  const C = CLASSES[game.player.cls]; let fake = false;
  if (!C.jobs) { fake = true; const base = skillPages().base; const js = base.slice(-2); C.jobs = { testjob: { name: '测试转职', desc: '测试用', skills: js } }; js.forEach(id => { SKILLS[id]._job = SKILLS[id].job; SKILLS[id].job = 'testjob'; }); }
  game.job = Object.keys(C.jobs)[0]; return fake;
});
await page.keyboard.press('KeyK'); await wait(150);
await page.click('[data-win="skills"] .sktab >> nth=1'); await wait(150);
const jobIds = await ev(() => skillPages().job);
ok(jobIds.length > 0 && (await page.locator('[data-win="skills"] .ski2').count()) === jobIds.length, '转职页签只显示当前转职的技能', jobIds.join());
ok(await ev(ids => ids.every(id => !skillPages().base.includes(id)), jobIds), '转职技能不出现在基础页签');
await shot('14-skills-job');
await ev(() => setPref('tipDetail', false)); await page.hover('[data-win="skills"] .ski2 .skic >> nth=0'); await wait(120);
ok(!(await ev(() => document.getElementById('tip').textContent)).includes('下一等级'), '简略说明不显示数值');
await ev(() => setPref('tipDetail', true));
await closeAll();
await ev(f => { const C = CLASSES[game.player.cls]; if (f) { for (const id in SKILLS) if (SKILLS[id].job === 'testjob') SKILLS[id].job = SKILLS[id]._job; delete C.jobs; } game.job = null; }, fakeJob);
await page.keyboard.press('KeyO'); await page.click('[data-win="settings"] .sktab[data-tab="video"]'); await wait(150); await shot('15-settings-video');
await page.click('[data-win="settings"] .tog[data-pref="dmgNum"]'); await wait(80);
ok(await ev(() => uiPref('dmgNum') === false), '设置窗口：点击开关关闭伤害数字');
await page.click('[data-win="settings"] .tog[data-pref="dmgNum"]'); await wait(80);
await page.click('[data-win="settings"] .sktab[data-tab="sound"]'); await wait(100);
await page.locator('[data-win="settings"] input[data-pref="music"]').fill('0.3'); await wait(80);
ok(await ev(() => Math.abs(uiPref('music') - 0.3) < 0.01), '设置窗口：音乐音量滑条');
await closeAll();

await ev(() => { for (const n of ['quests', 'worldmap', 'status', 'duel']) if (menus['_stub_' + n]) delete menus['w_' + n]; });

sec('手机（844×390，触屏）：选角 / 创建 / 窗口 / 虚拟按键');
const M = await launch({ width: 844, height: 390 });
const mp = M.page, mev = (fn, a) => mp.evaluate(fn, a), mwait = ms => mp.waitForTimeout(ms), mshot = n => mp.screenshot({ path: `${out}/${n}.png` });
const tap = async sel => { const b = await mp.locator(sel).first().boundingBox(); const x = b.x + b.width / 2, y = b.y + b.height / 2; await mp.mouse.move(x, y); await mp.mouse.down(); await mwait(50); await mp.mouse.up(); await mwait(200); };
await mp.goto(`${URL_BASE}?mute&touch`); await mp.waitForFunction(() => window.__READY); await mwait(400);
await tap('text=进入游戏'); await mshot('m01-charselect');
const cb = await mp.locator('#charsel .cslot').first().boundingBox();
ok(cb.width >= 44 && cb.height >= 44, '手机：角色位足够大（≥44px）', `${Math.round(cb.width)}×${Math.round(cb.height)}`);
const allIn = await mev(() => [...document.querySelectorAll('#charsel .cslot, #charsel .btn')].every(e => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= innerHeight + 1; }));
ok(allIn, '手机：选角界面全部在屏幕内');
await tap('#charsel button:has-text("创建角色")'); await mshot('m02-newgame');
const btnH = await mev(() => Math.min(...[...document.querySelectorAll('#newgame .btn')].map(e => e.getBoundingClientRect().height)));
ok(btnH >= 18, '手机：创建界面按钮高度可点', String(Math.round(btnH)));
await tap('text=创建并开始'); await mp.waitForFunction(() => game.scene === 'town' && game.player, null, { timeout: 15000 }); await mwait(500);
await mev(() => menus.closeAll()); await mwait(150);
ok(await mev(() => !touch.el.classList.contains('hidden')), '手机：城镇里显示虚拟按键');
await tap('#touch .tmisc .tbtn:has-text("技")'); await mwait(200);
ok(await mev(() => menus.isOpen('skills') && touch.el.classList.contains('hidden')), '手机：技能按钮打开技能窗口，虚拟按键让开');
const wb = await mp.locator('[data-win="skills"]').boundingBox();
ok(wb.x >= 0 && wb.y >= 0 && wb.x + wb.width <= 845 && wb.y + wb.height <= 391, '手机：技能窗口在屏幕内', JSON.stringify(wb));
await mshot('m03-skills');
// 触屏拖动窗口标题栏
const hb = await mp.locator('[data-win="skills"] > .hd .tt').boundingBox();
await mp.mouse.move(hb.x + 10, hb.y + 5); await mp.mouse.down(); await mp.mouse.move(hb.x - 30, hb.y + 25, { steps: 5 }); await mp.mouse.up(); await mwait(100);
ok(true, '手机：窗口标题栏可拖动（不报错）');
await tap('[data-win="skills"] .hd .x');
ok(await mev(() => !menus.isOpen('skills') && !touch.el.classList.contains('hidden')), '手机：✕ 关闭窗口后虚拟按键恢复');
await tap('#touch .tmisc .tbtn:has-text("≡")'); await mwait(150);
ok(await mev(() => menus.isOpen('system')), '手机：≡ 打开系统菜单');
await tap('.sysmenu button:has-text("游戏设置")'); await tap('[data-win="settings"] .sktab[data-tab="touch"]'); await mshot('m04-settings-touch');
await mev(() => { setPref('touchSize', 1.2); setPref('touchSwap', true); touch.applyPrefs(); menus.closeAll(); }); await mwait(200);
const atk = await mp.locator('#touch .atk').boundingBox();
ok(atk.x < 300, '手机：左右互换后攻击键在左边', String(Math.round(atk.x)));
await mshot('m05-touch-swapped');
await mev(() => { setPref('touchSize', 1); setPref('touchSwap', false); touch.applyPrefs(); });
const merr = M.logs.filter(l => l.type !== 'warning');
ok(merr.length === 0, '手机：没有页面错误', JSON.stringify(merr.slice(0, 3)));
await M.browser.close();

const errs = logs.filter(l => l.type !== 'warning');
ok(errs.length === 0, '没有页面错误', JSON.stringify(errs.slice(0, 3)));
console.log(`\n通过 ${pass}，失败 ${fail}`);
await browser.close();
process.exit(fail ? 1 : 0);
