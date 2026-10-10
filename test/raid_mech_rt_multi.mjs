// 团本领主机制运行时的多人化（game/raid_mech_rt.js）：同房全部玩家都是输入、队员的挨打 / 状态走 msNetEv、队员那边按 netState / mirror 镜像
//   用假的队员影子（coop.mates 里放一个 ghost）在单个浏览器里测主机这一侧；队员那一侧直接调 mirror.ev / hud 验证
// 用法：node test/raid_mech_rt_multi.mjs
import { launch, URL_BASE } from './lib.mjs';
import { setupRaidLab } from './lib_raidmech.mjs';
let fail = 0, n = 0;
const ok = (c, msg, d) => { n++; if (c) console.log('✓', msg); else { fail++; console.log('✗', msg, d !== undefined ? JSON.stringify(d).slice(0, 500) : ''); } return c; };
const { browser, page, logs } = await launch({ width: 1280, height: 720 });
await page.goto(`${URL_BASE}?test&mute&mon=msLab`); await page.waitForFunction(() => window.__READY, null, { timeout: 30000 });
await page.evaluate(async () => { await loadBundles(monBundles(['msLab'])); });
await setupRaidLab(page);
await page.evaluate(() => {
  window.NET = [];
  window.mkMate = (uid, x = 700, y = 100) => ({ ghost: true, uid, team: 'p', x, y, z: 0, face: 1, hp: 1000, hpMax: 1000, dead: false, away: false });
  window.host = (mates) => { coop.role = 'host'; coop.state = 'play'; coop.mates.clear(); for (const g of mates) coop.mates.set(g.uid, g); window.NET.length = 0; msNet = (m, st, ev, d) => window.NET.push(ev === 'hook' && d.h === 'rmHurt' ? { ev: 'hurt', d } : { ev, d }); /* 挨打走钩子通道，记成 hurt */ };
  window.unhost = () => { coop.role = null; coop.state = 'none'; coop.mates.clear(); msNet = null; };
  window.spawnB = spec => { const m = T.spawn(spec); m.nid = 777; return m; };
});
// 1. 名册：本机 + 队员影子；队员离开 / 倒下自动退出
{
  const r = await page.evaluate(() => {
    T.clear(); T.put(400); const g = mkMate(99); host([g]);
    spawnB({ intro: { dur: 0.1 }, weak: { every: 999, pool: [{ use: 'crystals' }] } }); SIM(0.3);
    const a = window.__st.S.C.players.slice(); g.dead = true; SIM(0.2); const b = window.__st.S.C.players.slice(); g.dead = false; SIM(0.2); const c = window.__st.S.C.players.slice(); unhost();
    return { a, b, c, rm: rmRoster().length };
  });
  ok(r.a.join() === 'me,99' && r.b.join() === 'me' && r.c.join() === 'me,99' && r.rm === 1, '名册：本机 + 队员影子，倒下的队员自动退出、回来又加进来', r);
}
// 2. 全屏击倒：每个人单独按蹲下判定（本机站着挨打、队员蹲下 = rmin 上报）
{
  const r = await page.evaluate(() => {
    T.clear(); T.put(400); const p = game.player; window.__keepOn = false; p.hp = p.hpMax; p.invul = 0; const g = mkMate(99); host([g]);
    spawnB({ intro: { dur: 0.1 }, atk: [{ every: [99, 99], first: 0.3, puzzle: { use: 'crouch' } }] });
    let lo = p.hp; SIM(3, () => { p.raidCrouch = true; rmMateIn(99, { c: 1 }); lo = Math.min(lo, p.hp); });
    const A = { me: p.hpMax - lo, mate: NET.filter(x => x.ev === 'hurt' && x.d.w === '99').length };
    T.clear(); T.put(400); p.hp = p.hpMax; p.invul = 0; window.NET.length = 0; spawnB({ intro: { dur: 0.1 }, atk: [{ every: [99, 99], first: 0.3, puzzle: { use: 'crouch' } }] });
    lo = p.hp; SIM(3, () => { p.raidCrouch = true; rmMateIn(99, { c: 0 }); lo = Math.min(lo, p.hp); });
    const B = { me: p.hpMax - lo, mate: NET.filter(x => x.ev === 'hurt' && x.d.w === '99').length, d: (NET.find(x => x.ev === 'hurt') || { d: {} }).d.d };
    window.__keepOn = true; unhost(); return { A, B };
  });
  ok(r.A.me === 0 && r.A.mate === 0, '全屏击倒：本机蹲下躲过、队员（上报蹲下）也没事', r.A);
  ok(r.B.mate >= 1 && r.B.d === 1 && r.B.me === 0, '全屏击倒：队员站着 → 主机给他发 hurt（打倒），本机蹲着没事', r.B);
}
// 3. 灭团：同房每个人都挨一遍（队员走消息）
{
  const r = await page.evaluate(() => {
    T.clear(); T.put(400); const p = game.player; window.__keepOn = false; p.hp = p.hpMax; p.invul = 0; const g1 = mkMate(98), g2 = mkMate(99); host([g1, g2]);
    spawnB({ intro: { dur: 0.1 }, weak: { every: 0.5, pool: [{ use: 'crystals', dur: 3 }] }, onFail: { frac: 0.5, down: true } });
    SIM(5); const w = NET.filter(x => x.ev === 'hurt'); const R = { me: p.hpMax - p.hp, mates: w.map(x => x.d.w + ':' + x.d.f), wipe: NET.some(x => x.ev === 'wipe'), cast: NET.some(x => x.ev === 'cast') };
    window.__keepOn = true; unhost(); return R;
  });
  ok(r.me > 0 && r.mates.includes('98:0.5') && r.mates.includes('99:0.5') && r.wipe && r.cast, '灭团：本机和两个队员都按最大 HP 50% 结算，并发 cast / wipe 给队员', r);
}
// 4. 哈妮尔传心：两个人时红心只发给持心的人；一个人时降级
{
  const r = await page.evaluate(() => {
    const spec = { intro: { dur: 0.1 }, atk: [{ every: [99, 99], first: 0.3, puzzle: { use: 'clear', n: 2, hold: 1, grow: 0, dur: 12, heart: true } }] };
    T.clear(); T.put(400); const g = mkMate(99); host([g]); spawnB(spec); SIM(0.6);
    const s = window.__st.S.side[0], who = s && s.heart && s.heart.who, sent = NET.filter(x => x.ev === 'stOn' && x.d.id === 'heart').map(x => x.d.w);
    unhost(); T.clear(); T.put(400); spawnB(spec); SIM(0.6); const s2 = window.__st.S.side[0];
    return { who, sent, solo: !!(s2 && !s2.heart) };
  });
  ok(r.who && (r.who === 'me' ? r.sent.length === 0 : r.sent.join() === r.who), '传心：两个人 → 红心给其中一个人（队员持心时发 stOn 给他）', r);
  ok(r.solo, '传心：一个人 → 降级，没有红心', r);
}
// 5. 谜题物件：队员打的算队员的（lastHitBy）；任何人打心脏都算
{
  const r = await page.evaluate(() => {
    T.clear(); T.put(400); const g = mkMate(99); host([g]);
    spawnB({ intro: { dur: 0.1 }, weak: { every: 0.5, pool: [{ use: 'heartbeat' }] } }); SIM(0.8);
    const st = window.__st, e = T.ent('heart:0'); let by = null;
    SIM(6, () => { if (!st.S.cast) return; if (st.S.cast.objs[0].glow && !by) { e.hp -= 1; e.lastHitBy = g; by = 'mate'; } });
    const n = st.S.cast ? st.S.cast.n : -1; unhost(); return { by, n, wh: rmWho(g), me: rmWho(game.player) };
  });
  ok(r.by === 'mate' && r.n === 1 && r.wh === '99' && r.me === 'me', '物件：队员（lastHitBy）打中发光的心脏算一拍；rmWho 区分队员 / 本机', r);
}
// 6. 队员一侧：netState 镜像 → hud / 标记；mirror.ev 的 hurt 只结算自己
{
  const r = await page.evaluate(() => {
    T.clear(); T.put(400); const g = mkMate(99); host([g]);
    const m = spawnB({ intro: { dur: 0.1 }, weak: { every: 0.5, pool: [{ use: 'pads', n: 3 }] } }); SIM(1.2);
    const M = BOSS_MECHS.raidScript, st = window.__st, ns = JSON.parse(JSON.stringify(M.netState(st)));
    unhost(); window.__keepOn = false;
    const gs = { id: 'raidScript', p: st.p, t: 0, done: false, mirror: true, u: 1 }; Object.assign(gs, ns);
    const guestM = { x: 900, y: 100, z: 0, h: 100, scale: 1, name: '测试领主', msMul: {} };
    const out = {}; out.marks = rmMarkList(gs).length; out.V = !!gs.V.cast;
    const cv = document.createElement('canvas'); cv.width = 1280; cv.height = 720; out.hud = M.hud(cv.getContext('2d'), guestM, gs, 560, 40, 800);
    const p = game.player; p.hp = p.hpMax; p.invul = 0; const myId = String(coop.me());
    MS_MIRROR.rmHurt(m, { w: 'someone-else', f: 0.2, d: 0 }); out.other = p.hp === p.hpMax;
    MS_MIRROR.rmHurt(m, { w: myId, f: 0.2, d: 0 }); out.mine = +(1 - p.hp / p.hpMax).toFixed(2);
    gs.ps = {}; p.invul = 0; M.mirror.ev(m, gs, gs.p, 'stOn', { w: myId, id: 'buried' }); out.buried = !!gs.ps.buried && !!(p.status && p.status.root);
    M.mirror.ev(m, gs, gs.p, 'stOff', { w: myId, id: 'buried' }); out.free = !gs.ps.buried && !(p.status && p.status.root);
    window.__keepOn = true; return out;
  });
  ok(r.marks === 3 && r.V && r.hud > 16, '队员镜像：netState 带过去的地面标记 / HUD 数据能画出读条条', r);
  ok(r.other && r.mine > 0.15 && r.mine < 0.25, '队员镜像：hurt 只有目标是自己才结算（20%）', r);
  ok(r.buried && r.free, '队员镜像：掩埋状态翻译成定身，解除后恢复', r);
}
// 7. 单人不受影响：没有 coop 时名册只有自己
{
  const r = await page.evaluate(() => { unhost(); T.clear(); T.put(400); spawnB({ intro: { dur: 0.1 }, weak: { every: 0.5, pool: [{ use: 'crystals' }] } }); SIM(1); return { players: window.__st.S.C.players.join(), roster: rmRoster().length }; });
  ok(r.players === 'me' && r.roster === 1, '单人：名册只有自己', r);
}
const errs = logs.filter(l => /pageerror|TypeError|ReferenceError/i.test(l));
ok(errs.length === 0, '页面没有报错', errs.slice(0, 3));
console.log(`\n${n - fail}/${n} 通过`);
await browser.close();
process.exit(fail ? 1 : 0);
