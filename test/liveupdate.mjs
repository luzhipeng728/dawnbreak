// 在线更新（net/liveupdate.js）：本地服务端托管一份临时网页版（index.html 复制、素材链接到 dist/web/assets），改 index.html 的 BUILD_ID + version.json 模拟一次部署
// ① 城镇：出现提示、不挡操作 → 点击 → 存档后刷新 → 同一角色 / 场景 / 坐标 / 朝向、窗口重新打开、提示“已更新到最新版本”，同版本不再提示
// ② 地下城：“打完这局再更新” → 局内不刷新 → 回城倒计时后自动更新
// ③ 登录账号：刷新后仍用账号云存档（save.key = dawnbreak_cloud_<uid>），更新前的改动已上传到服务器
// ④ 调试参数页面（?town）不检测更新
// 用法：node build.mjs --web && node test/liveupdate.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startServer, launchPlayers, ok, result, until, uiRegister, uiCreateChar, dumpErrors, authInfo } from './net_lib.mjs';
const ROOT = new URL('..', import.meta.url).pathname, WEB = path.join(ROOT, 'dist/web');
const out = path.join(ROOT, 'test/shots/liveupdate'); fs.mkdirSync(out, { recursive: true });
const site = fs.mkdtempSync(path.join(os.tmpdir(), 'dnf-lu-'));
fs.symlinkSync(path.join(WEB, 'assets'), path.join(site, 'assets'));
const page0 = fs.readFileSync(path.join(WEB, 'index.html'), 'utf8'), id0 = JSON.parse(fs.readFileSync(path.join(WEB, 'version.json'), 'utf8')).id;
if (!page0.includes(`const BUILD_ID = '${id0}'`)) throw new Error('dist/web 的 index.html 和 version.json 版本号对不上，先 node build.mjs --web');
// 部署顺序和 tools/deploy.sh 一样：先页面，最后 version.json
const deploy = id => {
  fs.writeFileSync(path.join(site, 'index.html'), page0.replace(`const BUILD_ID = '${id0}'`, `const BUILD_ID = '${id}'`));
  fs.writeFileSync(path.join(site, 'version.json'), JSON.stringify({ id, time: new Date().toISOString(), notes: '测试更新 ' + id }));
};
deploy(id0);
const srv = await startServer({ static: site });
const { players, close } = await launchPlayers(2);
const [A, B] = players.map(p => p.page);
const bar = P => P.evaluate(() => { const e = document.getElementById('lubar'); return e && !e.hidden ? { cls: e.className, text: e.textContent } : null; });
const ready = P => P.waitForFunction(() => window.__READY, null, { timeout: 60000 });
const state = P => P.evaluate(() => ({ id: BUILD_ID, scene: game.scene, sid: world && world.S.id, x: Math.round(game.player.x), y: Math.round(game.player.y), face: game.player.face, name: save.data && save.data.name, gold: game.gold, key: save.key,
  menus: menus.stack.slice(), toast: toastList.some(t => t.msg === '已更新到最新版本') }));
try {
  // ---- ① 城镇里更新 ----
  await A.goto(srv.url + '?mute'); await ready(A);
  await until(A, () => [...document.querySelectorAll('#title button')].some(b => b.textContent === '不登录直接玩'));
  await A.click('#title button:has-text("不登录直接玩")'); await until(A, () => menus.isOpen('charselect'));
  ok(await uiCreateChar(A, 0, '更新剑士'), '创建本机角色并进城');
  await A.evaluate(() => liveUpdate.check(true));
  ok(!(await bar(A)), '版本相同：不提示');
  deploy('lu00000000v2');
  await A.evaluate(() => liveUpdate.check(true));
  ok(await until(A, () => document.getElementById('lubar') && !document.getElementById('lubar').hidden, null, 8000), '部署新版本后出现更新横幅', await bar(A));
  const b1 = await bar(A);
  ok(b1 && b1.cls === 'lu-new' && b1.text.includes('发现新版本') && b1.text.includes('进度自动保存') && b1.text.includes('测试更新 lu00000000v2'), '横幅文字：发现新版本 / 进度自动保存 / 更新内容', b1);
  // 不挡操作：没有弹窗、角色照样能走
  const x0 = await A.evaluate(() => game.player.x);
  await A.keyboard.down('ArrowRight'); await until(A, x => game.player.x > x + 30, x0, 5000); await A.keyboard.up('ArrowRight');
  const st0 = await A.evaluate(() => ({ modal: menus.modal(), paused: game.paused, x: game.player.x }));
  ok(!st0.modal && !st0.paused && st0.x > x0 + 30, '横幅不挡操作（没有模态窗口、角色能走）', { x0, ...st0 });
  await A.evaluate(() => { const p = game.player; p.x += 57; p.face = -1; game.gold = 23456; menus.show('inv'); });
  const before = await state(A);
  await A.screenshot({ path: `${out}/01-banner.png` });
  await Promise.all([A.waitForEvent('load', { timeout: 30000 }), A.click('#lubar .lut')]);
  await ready(A);
  const after = await state(A);
  ok(after.id === 'lu00000000v2', '刷新后是新版本', after.id);
  ok(after.scene === 'town' && after.sid === before.sid && after.x === before.x && after.y === before.y && after.face === -1, '回到同一场景、同一坐标和朝向（跳过标题 / 选角）', { before, after });
  ok(after.name === '更新剑士' && after.gold === 23456, '同一角色，点更新前的改动（金币）已保存', after);
  ok(after.menus.includes('inv') && !after.menus.includes('title') && !after.menus.includes('charselect'), '刷新前开着的背包重新打开', after.menus);
  ok(after.toast, '提示“已更新到最新版本”');
  await A.screenshot({ path: `${out}/02-resumed.png` });
  await A.evaluate(() => liveUpdate.check(true));
  ok(!(await bar(A)), '已是最新版本：不再提示');
  // ---- ② 地下城里：打完这局再更新 → 回城自动更新 ----
  await A.evaluate(() => { menus.closeAll(); enterDungeon('lorien', 0); });
  ok(await until(A, () => game.scene === 'dungeon' && game.dungeon), '进入地下城');
  deploy('lu00000000v3');
  await A.evaluate(() => { liveUpdate.lastCheck = 0; window.dispatchEvent(new Event('focus')); });   // 窗口获得焦点时检测
  ok(await until(A, () => { const e = document.getElementById('lubar'); return e && !e.hidden && e.className === 'lu-run'; }, null, 8000), '地下城里：提示“打完这局再更新 / 立即更新”', await bar(A));
  await A.screenshot({ path: `${out}/03-dungeon.png` });
  await A.click('#lubar button:has-text("打完这局再更新")');
  const t0 = await A.evaluate(() => game.t);
  ok(await until(A, t => game.t > t + 2 && document.getElementById('lubar').className === 'lu-wait', t0, 10000), '点“打完这局再更新”：局内不刷新，缩成小提示', await bar(A));
  ok((await A.evaluate(() => BUILD_ID + ':' + game.scene)) === 'lu00000000v2:dungeon', '还在这局地下城里');
  const loaded = A.waitForEvent('load', { timeout: 30000 });
  await A.evaluate(() => { menus.closeAll(); game.paused = false; lootAll(); goTown(); });
  ok(await until(A, () => { const e = document.getElementById('lubar'); return e && !e.hidden && e.className === 'lu-count'; }, null, 8000), '回到城镇：倒计时自动更新', await bar(A).catch(() => null));
  await A.screenshot({ path: `${out}/04-countdown.png` });
  await loaded; await ready(A);
  const s2 = await state(A);
  ok(s2.id === 'lu00000000v3' && s2.scene === 'town' && s2.name === '更新剑士' && !s2.menus.includes('title'), '回城后自动更新到新版本，接着玩同一角色', s2);
  // ---- ③ 登录账号：刷新后用云存档 ----
  await B.goto(srv.url + '?town&mute'); await B.waitForFunction(() => typeof liveUpdate !== 'undefined');
  ok(!(await B.evaluate(() => liveUpdate.on)), '调试参数页面（?town）不检测更新');
  ok(await uiRegister(B, srv.url, 'luacct'), '注册 luacct', authInfo);
  ok(await uiCreateChar(B, 1, '云端枪手'), '账号里建角色并进城');
  await until(B, () => cloudSave.checked && !cloudSave.dirty && !cloudSave.busy);
  const uid = await B.evaluate(() => net.user.id);
  await B.evaluate(() => { game.gold = 34567; });   // 只改内存，不存档：靠更新前的保存 + 云存档上传
  deploy('lu00000000v4');
  await B.evaluate(() => liveUpdate.check(true));
  ok(await until(B, () => document.getElementById('lubar') && !document.getElementById('lubar').hidden, null, 8000), '账号玩家看到更新横幅');
  const bb = await state(B);
  await Promise.all([B.waitForEvent('load', { timeout: 30000 }), B.click('#lubar .lut')]);
  const cloudGold = (() => { const c = srv.app.ctx.mods.saves.read(uid); return c && c.data && (c.data.chars.find(x => x.name === '云端枪手') || {}).gold; })();
  ok(cloudGold === 34567, '刷新前已把进度上传到云存档', cloudGold);
  await ready(B);
  const sb = await state(B);
  ok(sb.id === 'lu00000000v4' && sb.key === 'dawnbreak_cloud_' + uid && sb.name === '云端枪手' && sb.gold === 34567, '刷新后用账号云存档回到同一角色', sb);
  ok(sb.scene === 'town' && sb.sid === bb.sid && sb.x === bb.x && sb.y === bb.y, '账号玩家回到同一位置', { bb, sb });
  const errs = dumpErrors(players);
  ok(!errs.length, '没有页面报错', errs);
} finally {
  await close(); await srv.stop(); fs.rmSync(site, { recursive: true, force: true });
}
const { fails, total } = result();
console.log(`\n在线更新：${total - fails}/${total} 通过`);
process.exit(fails ? 1 : 0);
