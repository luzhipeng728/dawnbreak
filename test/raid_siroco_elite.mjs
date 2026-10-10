// 希洛克团本精英 / 小怪（content/raids/siroco_raid.js）：数据一致性（纯 vm）+ 浏览器里每个精英真的挂上破防条件、打得动、倒下上报
//   纯逻辑：6 种破防条件都用上、精英怪物 id / 房间 eliteSpec / 节点 elites 三处对得上、每种小怪 ≥ 3 个技能、精英击杀走规则核心生效
//   浏览器：每个精英生成 → raidEliteAttach → 跑 30 秒不报错、受到伤害倍率 = 护盾倍率；触发破防条件后倍率变 weakMul；倒下后 raidNet.eliteKill 被调用
// 用法：node test/raid_siroco_elite.mjs
import fs from 'fs'; import vm from 'vm';
import { launch, URL_BASE } from './lib.mjs';
const rd = f => fs.readFileSync(new URL('../src/' + f, import.meta.url), 'utf8');
let fail = 0, n = 0;
const ok = (c, msg, d) => { n++; console.log((c ? '✓ ' : '✗ ') + msg + (c || d === undefined ? '' : '  ' + JSON.stringify(d).slice(0, 300))); if (!c) fail++; return c; };

// ---- 纯逻辑 ----
const DG = {}, MONS = {};
const base = {}; vm.runInNewContext(rd('game/raid_core.js') + '\n' + rd('game/raid_elite.js') + '\nthis.RAID_CORE = RAID_CORE; this.RAID_DEFS = RAID_DEFS; this.RAID_ELITES = RAID_ELITES; this.defineRaidElite = defineRaidElite;', base);
const stub = { regionTheme() {}, regionMonster(spec, id, M) { MONS[id] = M; }, MON: {}, MON_ART: {}, RAID_DEFS: base.RAID_DEFS, defineRaidElite: base.defineRaidElite, SIROCO_RAID_GEAR: [], defineDungeon: (id, d) => { DG[id] = { id, ...d }; } };
vm.runInNewContext(rd('content/raids/siroco_raid.js'), stub);
const ELITES = base.RAID_ELITES, types = new Set(Object.values(ELITES).map(e => e.type));
ok(Object.keys(ELITES).length === 6 && types.size === 6, '6 个希洛克精英，用满 6 种破防条件', [...types]);
for (const [id, E] of Object.entries(ELITES)) {
  const M = MONS[E.mon];
  ok(M && M.tier === 'elite' && (M.skills || []).length >= 3, `${id}：精英怪 ${E.mon} 有专属技能组（${(M && M.skills || []).length} 个）`, M && M.skills);
}
const mobs = Object.entries(MONS).filter(([k, M]) => M.tier !== 'elite' && /^siRaidMob_(grim|siroco)/.test(k));
ok(mobs.length === 4 && mobs.every(([, M]) => M.skills.length >= 3), '4 种小怪都有 ≥ 3 个真实技能（不再是占位）', mobs.map(([k, M]) => k + ':' + M.skills.length));
const used = new Map();
for (const D of Object.values(DG)) for (const r of D.fixed.rooms || []) if (r.eliteSpec) { used.set(r.eliteSpec, D.id); ok(!!ELITES[r.eliteSpec] && ELITES[r.eliteSpec].mon === r.elite, `${D.id} 房间 ${r.name || r.eliteSpec}：eliteSpec 和精英怪对得上`, r); }
ok([...used.keys()].sort().join() === Object.keys(ELITES).sort().join(), '每个精英都至少放在一个房间里', [...used.keys()]);
const nodes = {}; for (const mode of ['normal', 'guide']) for (const p of base.RAID_CORE.graph('siroco', mode).phases) for (const [k, nd] of Object.entries(p.nodes)) nodes[mode + ':' + k] = nd;
for (const [eid, dg] of used) { const hit = Object.values(nodes).filter(nd => nd.dg === dg && nd.elites && nd.elites[eid]); ok(hit.length >= 1, `${eid}（${dg}）：节点 elites 里有击杀效果（${hit.length} 个节点）`); }
{
  const R = base.RAID_CORE; let T = 1e6;
  const S = R.init('siroco', [{ uid: 1, cid: 'a', name: 'a' }, { uid: 2, cid: 'b', name: 'b' }], 'normal', T, { sid: 'e', seed: 3 });
  R.event(S, { t: 'ready', uid: 2, on: true }, T); R.event(S, { t: 'start', uid: 1 }, T);
  const e = R.event(S, { t: 'enter', uid: 1, node: 'law_a' }, T + 1000), run = e.ack.run;
  const k = R.event(S, { t: 'elite', uid: 1, run, v: 'siEliteGate' }, T + 2000);
  ok(!k.err && S.gbuffs.some(b => b.id === 'gate_down'), '门倒下：规则核心给全团增益', k.err || S.gbuffs);
  ok(R.event(S, { t: 'elite', uid: 1, run, v: 'siEliteGate' }, T + 3000).ack.dup === true, '同一个门只算一次');
  ok(R.event(S, { t: 'elite', uid: 1, run, v: 'siEliteKula' }, T + 4000).err.code === 'elite', '别的图的精英上报被拒');
}

// ---- 浏览器 ----
const { browser, page, logs } = await launch({ width: 1280, height: 720 });
await page.goto(`${URL_BASE}?test&mute&mon=msLab`); await page.waitForFunction(() => window.__READY, null, { timeout: 30000 });
await page.evaluate(() => { game.paused = true; Math.random = mulberry(7); window.SIM = sec => { for (let i = 0; i < Math.round(sec * 60); i++) { step(1 / 60); game.player.hp = game.player.hpMax; } }; });
const ids = Object.keys(ELITES);
await page.evaluate(async ids => { const mons = ids.map(id => RAID_ELITES[id].mon); await loadBundles(monBundles(['msLab', ...mons])); }, ids);
for (const id of ids) {
  const r = await page.evaluate(id => {
    for (let k = ents.length - 1; k >= 0; k--) if (ents[k].team === 'e') ents.splice(k, 1);
    const sp = RAID_ELITES[id], p = game.player; p.x = 300; p.y = 100; const kills = []; const o = raidNet.eliteKill; raidNet.eliteKill = v => kills.push(v);
    const m = spawnMonster(sp.mon, 900, 100, { lvl: 62, elite: true }); m.z = 0; const E = raidEliteAttach(m, id, {});
    let err = null; try { SIM(30); } catch (e) { err = String(e.stack).slice(0, 300); }
    const R = { id, type: E.type, mul0: RAID_ELITE.mul(E), t: +E.t.toFixed(1), name: m.name, err, brk: false };
    const clones = () => { for (const o2 of E.objs.slice()) RAID_ELITE.on(E, { k: { ball: 'ball', orb: 'intercept', clone: 'cloneDead', shell: 'shellBroken' }[o2.what], i: o2.i }); };
    if (E.type === 'breakShell') clones();
    else if (E.type === 'counterBreak') { E.wind = 1; E.wt = E.p.flashAt + 0.1; RAID_ELITE.on(E, { k: 'hit' }); }
    else if (E.type === 'killClone' || E.type === 'eyeGuard') { E.next = 0; RAID_ELITE.tick(E, 0.1); clones(); }
    else { for (let q = 0; q < 6 && E.weak <= 0; q++) { E.next = 0; RAID_ELITE.tick(E, 0.1); clones(); } }
    R.brk = E.weak > 0; R.mulBrk = RAID_ELITE.mul(E);
    m.hp = 0; killEnt(m, p, {}); SIM(0.5); R.kills = kills; raidNet.eliteKill = o; return R;
  }, id);
  ok(!r.err && r.t >= 29 && r.name === ELITES[id].name, `${id}（${r.type}）：生成 → 挂上破防条件 → 跑 30 秒不报错`, r);
  ok(r.mul0 <= 1 && r.mulBrk > 1 && r.brk, `${id}：平时倍率 ×${r.mul0}，满足破防条件后 ×${r.mulBrk}`, r);
  ok(r.kills.join() === id, `${id}：倒下后上报 eliteKill`, r.kills);
}
const errs = logs.filter(l => /pageerror|TypeError|ReferenceError/i.test(l));
ok(errs.length === 0, '页面没有报错', errs.slice(0, 3));
console.log(fail ? `\n${fail}/${n} 项失败` : `\n全部通过（${n} 项）`);
await browser.close();
process.exit(fail ? 1 : 0);
