// test/boss.mjs 的 coop 部分：2 个真实客户端（net_lib.mjs）组队，逐个地下城传到领主房，主机逐招强制放、逐阶段压血，
// 对比两边（做法同 mp_bosses.mjs）：地面预警一一配对（同类型同半径、时间差 < 0.3 秒）、领主机制启动 / 钩子事件一一对应、队员被领主打中；两边页面都不能报错
// 主机本人无敌站在最左边，领主盯着队员；队员站在每一招的出手距离里、不还手、不无敌（血低于 60% 补满）
// 有 P0-E 的 MS_EVENTS 时再把两边的事件按类型对一遍（只报告，--strict 时不一致算失败）
import fs from 'node:fs';
import { startServer, launchPlayers, ok, result, sleep, until, uiRegister, uiCreateChar, dumpErrors } from './net_lib.mjs';

const PROBE = () => {
  if (window.__q) return;
  const Q = window.__q = { on: false, seg: '', tg: [], hk: [], mech: [], hurt: [], ev0: 0 };
  const tg0 = window.telegraph; window.telegraph = function (o) { const g = tg0.apply(this, arguments); if (Q.on) Q.tg.push({ seg: Q.seg, T: Date.now(), kind: g.kind, r: Math.round(g.r), mech: g.mech || null }); return g; };
  const send0 = coop.send; coop.send = function (d, to) { if (Q.on && d && d.k === 'mech' && coop.role === 'host') { if (d.e === 'hook') Q.hk.push({ seg: Q.seg, h: d.d.h, T: Date.now() }); else if (d.e === 'start') Q.mech.push({ seg: Q.seg, id: d.use, T: Date.now() }); } return send0.call(this, d, to); };
  const cr0 = window.coopMechRecv; window.coopMechRecv = function (d) { if (Q.on && d) { if (d.e === 'hook') Q.hk.push({ seg: Q.seg, h: d.d && d.d.h, T: Date.now() }); else if (d.e === 'start') Q.mech.push({ seg: Q.seg, id: d.use, T: Date.now() }); } return cr0.apply(this, arguments); };
  const hu0 = game.onPlayerHurt; game.onPlayerHurt = function (p, dmg, a) { if (Q.on && p === game.player) Q.hurt.push({ seg: Q.seg, dmg: Math.round(dmg), mech: msNetSrc || null, kind: a && a.kind, boss: !!(a && a.boss) }); return hu0.call(this, p, dmg, a); };
  Q.evs = () => { if (typeof MS_EVENTS === 'undefined' || !MS_EVENTS) return null; const L = Array.isArray(MS_EVENTS) ? MS_EVENTS : MS_EVENTS.list || MS_EVENTS.log || MS_EVENTS.events || null; return L; };
};
const DUMP = () => { const Q = window.__q, L = Q.evs(); return { ...Q, ev: L ? L.slice(Q.ev0).map(e => String(e.type || e.ev || e.e || e.kind || '?')) : null }; };
function matchTg(ht, gt, endT) {
  const used = new Set(), miss = [], dts = [];
  for (const a of ht.filter(x => x.T < endT - 500)) {
    let best = -1, bd = 1e9; gt.forEach((b, j) => { if (used.has(j) || b.kind !== a.kind || b.r !== a.r) return; const d = Math.abs(b.T - a.T); if (d < bd) { bd = d; best = j; } });
    if (best >= 0 && bd <= 300) { used.add(best); dts.push(bd); } else miss.push(`${a.kind}/${a.r}`);
  }
  return { host: ht.length, matched: dts.length, miss, maxDt: dts.length ? Math.max(...dts) : 0 };
}
function matchEv(hl, gl, key) {
  const A = {}, B = {}, dt = []; for (const x of hl) (A[x[key]] ??= []).push(x.T); for (const x of gl) (B[x[key]] ??= []).push(x.T);
  for (const k in A) A[k].forEach((T, i) => { if (B[k] && B[k][i] !== undefined) dt.push(Math.abs(B[k][i] - T)); });
  const cnt = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v.length]).sort());
  return { host: cnt(A), guest: cnt(B), same: JSON.stringify(cnt(A)) === JSON.stringify(cnt(B)), maxDt: Math.max(0, ...dt) };
}
const tally = L => { const o = {}; for (const x of L) o[x] = (o[x] || 0) + 1; return o; };

export async function runCoop(DGS, { OUT, readJ, strict = process.argv.includes('--strict') }) {
  const srv = await startServer();
  const { players, close } = await launchPlayers(2);
  const pages = players.map(p => p.page), names = ['alice', 'bob'], [H, G] = pages;
  const segEnd = {};
  const seg = async (name, fn) => { for (const P of pages) await P.evaluate(n => { window.__q.seg = n; window.__q.on = true; }, name); await fn(); await sleep(800); segEnd[name] = Date.now(); for (const P of pages) await P.evaluate(() => { window.__q.on = false; }); };
  const hostWait = sec => H.evaluate(s => new Promise(res => { const t0 = game.t, iv = setInterval(() => { if (game.t - t0 >= s) { clearInterval(iv); res(); } }, 50); }), sec);
  const killAdds = () => H.evaluate(() => { const b = game.dungeon && game.dungeon.boss; for (const e of [...ents]) if (e.team === 'e' && !e.dead && e !== b) { e.invul = 0; e.hp = 0; killEnt(e, game.player, {}); } });
  let f0 = result().fails;
  try {
    for (let i = 0; i < 2; i++) {
      ok(await uiRegister(pages[i], srv.url, names[i]), `coop：${names[i]} 注册`);
      ok(await uiCreateChar(pages[i], 0), `coop：${names[i]} 建角色进城`);
      await pages[i].evaluate(PROBE);
    }
    await H.evaluate(() => netPartyInvite(null, 'bob'));
    await until(G, () => menus.isOpen('nd_pinv'), null, 8000);
    await G.click('.netask button:has-text("加入队伍")');
    ok(await until(H, () => netParty.p && netParty.p.members.length === 2, null, 8000), 'coop：组队 2 人');
    for (const did of DGS) {
      const file = `${OUT}/${did}.json`, R = readJ(file) || { id: did }, out = { segs: [] };
      console.log(`\n== coop ${did}`);
      const lv = +(process.env.COOPLV || 0) || await H.evaluate(id => DUNGEONS[id].lvl[1], did);
      for (const P of pages) await P.evaluate(({ lv, did }) => { menus.closeAll && menus.closeAll(); testLoadout(lv); save.data.fatigue = 999; const U = DUNGEONS[did].unlock; if (U && U.quest) save.data.questDone[U.quest] = Date.now(); save.write(); netTown.hello(true); document.getElementById('dom').style.visibility = 'hidden'; }, { lv, did });
      const scene = await H.evaluate(id => { for (const s in SCENES) if (SCENES[s].gates.some(g => g.dungeon === id)) return s; return null; }, did);
      if (scene) { await H.evaluate(s => worldTravel(s), scene); await until(H, s => world && world.S.id === s, scene); }
      await H.evaluate(id => enterDungeon(id, 0), did);
      const allIn = await Promise.all(pages.map(P => until(P, id => game.scene === 'dungeon' && game.dungeon && game.dungeon.def.id === id && coop.state === 'play' && !game.dungeon.transition, did, 60000)));
      if (!ok(allIn.every(Boolean), `coop ${did}：全队进图`, allIn)) continue;
      // 主机传到领主房，发 room 事件让队员跟过来
      await H.evaluate(() => { const dg = game.dungeon, B = dg.layout.boss; for (const r of dg.layout.rooms) if (r.type !== 'boss') { r.visited = true; r.cleared = true; } lootAll(); projs.length = 0; groundFx.length = 0; dg.transition = { phase: 'out', t: 0, room: B, from: 'left' }; coop.send({ k: 'room', gx: B.gx, gy: B.gy, from: 'left' }); });
      const inBoss = await Promise.all(pages.map(P => until(P, () => game.dungeon && game.dungeon.room.type === 'boss' && !game.dungeon.transition, null, 20000)));
      const nid = await H.evaluate(() => game.dungeon.boss && game.dungeon.boss.nid);
      const pup = await until(G, id => coop.puppets.has(id), nid, 10000);
      if (!ok(inBoss.every(Boolean) && pup, `coop ${did}：全队到了领主房，队员这边有领主的傀儡`, { inBoss, pup })) continue;
      await sleep(600); await killAdds();
      // 主机：无敌、站最左边、所有怪盯队员、领主不自己出招不走动；队员：跟着指定位置站
      await H.evaluate(() => { bot.on = false; game.speedMul = 1; const p = game.player; p.invul = 1e9; const b = game.dungeon.boss; b.hp = b.hpMax;
        window.__aim = setInterval(() => { const g = [...coop.mates.values()][0], p = game.player; p.hp = p.hpMax; p.invul = 1e9; if (p.x > 120) { p.x = 60; p.y = DEPTH / 2; }
          for (const m of ents) if (m.nid && !m.dead && m.team === 'e') { m.tgt = g; m.tgtT = game.t + 1e6; if (m === game.dungeon.boss) { m.aiCd = Math.max(m.aiCd || 0, 5); if (!m.busy) { m.vx = 0; m.vy = 0; } } } }, 100); });
      await G.evaluate(() => { bot.on = false; game.speedMul = 1; const p = game.player; p.invul = 0; window.__pos = null;
        window.__stick = setInterval(() => { const p = game.player, P = window.__pos; if (p.hp < p.hpMax * 0.6) p.hp = p.hpMax; if (p.st === 'idle' || p.st === 'walk') p.invul = 0;
          const B = [...coop.puppets.values()].find(m => m.boss && !m.dead && ents.includes(m));
          if (P && B && p.st !== 'hit' && p.st !== 'down' && p.st !== 'air' && !p.act && p.st !== 'held') { p.x = clamp(B.x + P.dx, 40, game.room.x1 - 40); p.y = B.y; p.face = B.x >= p.x ? 1 : -1; } }, 100); });
      const atk = await H.evaluate(() => game.dungeon.boss.def_.attacks.map((A, i) => ({ i, ms: A.ms || A.clip, range: A.range || [0, 80] })));
      const hurtBy = {};
      for (const A of atk) {
        const dx = -Math.round(Math.max(40, Math.min(360, (A.range[0] + Math.min(A.range[1], 400)) / 2)));
        await G.evaluate(dx => { window.__pos = { dx }; }, dx);
        await H.evaluate(() => { const b = game.dungeon.boss; b.x = Math.round(game.room.x1 * 0.62); b.hp = b.hpMax; });
        await sleep(500);
        const name = `s${A.i}`;
        await seg(name, async () => {
          await H.evaluate(i => { const b = game.dungeon.boss, g = [...coop.mates.values()][0], P = game.player; b.tgt = g; b.tgtT = game.t + 1e6; game.player = g; try { monForceSkill(b, i); } finally { game.player = P; } }, A.i);
          await hostWait(3.2);
        });
        await killAdds();
        await H.evaluate(() => { groundFx.length = 0; });
      }
      // 阶段：主机逐个压血（藏起来的阶段：打掉水晶 / 小怪）
      const P = await H.evaluate(() => (game.dungeon.boss.def_.msPhases || []).map(p => p.at));
      if (P.length > 1) {
        await G.evaluate(() => { window.__pos = { dx: -200 }; });
        await seg('ph', async () => {
          for (let i = 1; i < P.length; i++) {
            await H.evaluate(i => { const b = game.dungeon.boss, P = b.def_.msPhases[i]; if (typeof bossPhaseSet === 'function') bossPhaseSet(b, i); else b.hp = Math.max(1, Math.floor(b.hpMax * P.at) - 1); }, i);
            await hostWait(3.5);
            await H.evaluate(() => { const b = game.dungeon.boss; for (const s of b.msMechs || []) if (s.id === 'invuln') { if (s.p.until === 'survive') s.t = Math.max(s.t, s.p.survive); if (s.p.until === 'hook') b.msInvulDone = true; } });
            await killAdds();
            await hostWait(1.2);
          }
        });
      }
      // 对比
      const h = await H.evaluate(DUMP), g = await G.evaluate(DUMP);
      const names2 = [...atk.map(A => `s${A.i}`), ...(P.length > 1 ? ['ph'] : [])];
      let tgHost = 0, tgMatched = 0, maxDt = 0; const miss = [];
      for (const n of names2) {
        const f = x => x.seg === n, tm = matchTg(h.tg.filter(f), g.tg.filter(f), segEnd[n]), me = matchEv(h.mech.filter(f), g.mech.filter(f), 'id'), hk = matchEv(h.hk.filter(f), g.hk.filter(f), 'h');
        const gh = g.hurt.filter(f), boss = gh.filter(x => x.boss || x.mech).length;
        hurtBy[n] = boss; tgHost += tm.host; tgMatched += tm.matched; maxDt = Math.max(maxDt, tm.maxDt, me.maxDt, hk.maxDt); miss.push(...tm.miss.map(x => `${n}:${x}`));
        out.segs.push({ seg: n, move: n === 'ph' ? '阶段' : atk.find(A => `s${A.i}` === n).ms, tele: `${tm.matched}/${tm.host}`, teleDt: tm.maxDt, mech: me.host, mechSame: me.same, hook: hk.host, hookSame: hk.same, guestHurt: boss });
        ok(me.same && me.maxDt < 300, `coop ${did} ${n}：领主机制启动两边一致（${JSON.stringify(me.host)}，${me.maxDt}ms）`, me);
        ok(hk.same && hk.maxDt < 300, `coop ${did} ${n}：钩子事件两边一致（${JSON.stringify(hk.host)}，${hk.maxDt}ms）`, hk);
      }
      console.table(out.segs.map(s => ({ ...s, mech: JSON.stringify(s.mech), hook: JSON.stringify(s.hook) })));
      ok(!miss.length && maxDt < 300, `coop ${did}：地面预警队员这边一个不少（${tgMatched}/${tgHost}），最大时间差 ${maxDt}ms < 0.3 秒`, miss.slice(0, 8));
      const hit = Object.values(hurtBy).reduce((a, b) => a + b, 0);
      ok(hit > 0, `coop ${did}：队员被领主 / 机制打中 ${hit} 次（${Object.entries(hurtBy).filter(([, v]) => v).map(([k, v]) => k + '×' + v).join(' ') || '—'}）`);
      if (h.ev && g.ev) {
        const A = tally(h.ev), B = tally(g.ev), same = JSON.stringify(Object.entries(A).sort()) === JSON.stringify(Object.entries(B).sort());
        out.msEvents = { host: A, guest: B, same };
        if (strict) ok(same, `coop ${did}：MS_EVENTS 两边一致`, out.msEvents); else console.log(`  MS_EVENTS 主机 ${JSON.stringify(A)} / 队员 ${JSON.stringify(B)}${same ? '' : '（不一致）'}`);
      }
      const fe = await Promise.all(pages.map(P => P.evaluate(() => frameErrs.map(e => `${e.where} ×${e.n}：${e.msg}`))));
      ok(fe.every(l => !l.length), `coop ${did}：两边都没有逐帧报错`, fe);
      await Promise.all(pages.map((P, i) => P.screenshot({ path: `${OUT}/${did}-coop-${names[i]}.jpg`, type: 'jpeg', quality: 60 })));
      for (const P of pages) await P.evaluate(() => { clearInterval(window.__aim); clearInterval(window.__stick); const Q = window.__q; for (const k of ['tg', 'hk', 'mech', 'hurt']) Q[k].length = 0; const L = Q.evs(); Q.ev0 = L ? L.length : 0; });
      await G.evaluate(() => { menus.closeAll(); goTown(); }); await H.evaluate(() => { menus.closeAll(); goTown(); });
      await Promise.all(pages.map(P => until(P, () => game.scene === 'town' && coop.state === 'none', null, 20000)));
      await sleep(800);
      R.coop = { ...out, tele: `${tgMatched}/${tgHost}`, maxDt, guestHurt: hit, at: new Date().toISOString() };
      fs.writeFileSync(file, JSON.stringify(R, null, 1));
    }
    const errs = [...new Set(dumpErrors(players).map(s => s.slice(0, 300)))];
    ok(!errs.length, 'coop：两边页面都没有报错', errs.slice(0, 5));
  } catch (e) { ok(false, 'coop 异常：' + (e.stack || e)); }
  await close(); await srv.stop();
  return result().fails - f0;
}
