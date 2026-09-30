// 通用领主测试（docs/BOSS_PLAN.md §4.2 P0-C）：进图后直接传到领主房，逐阶段 / 逐招 / 逐机制验一遍，机器人打一遍，组队对照一遍
//   node test/boss.mjs <地下城,...|all|区域 id|legacy|region> [部分,...] [--strict]
//   node test/boss.mjs table        汇总 test/shots/boss/*.json → 基线表（markdown，贴进 BOSS_PLAN §4.5）
//   node test/boss.mjs              什么都不写 = 快速样本 graca,skasa_nest data,phases,skills,mechs（test/affected.mjs 改了本文件时跑这个）；全量写 all
// 部分（默认 data,phases,skills,mechs,bot；coop 要单独写上）：
//   data    数据：领主 / 精灵 / 片段 / 阶段顺序 / 机制库 / 钩子 / 召唤物都在；招式数、招牌数（tools/boss_inventory.mjs 同一套规则）
//   phases  逐个把血量压到阶段门槛（有 bossPhaseSet 就用它），检查进了阶段、阶段机制启动；领主藏起来的阶段按机制解开
//   skills  逐招强制放（monForceSkill），玩家站在出手距离内：记地面预警（个数 / 时长）、被打中（次数 / 出手到命中的时间）、投射物、召唤、机制
//   mechs   领主用到的每个机制（出场 + 阶段 + 技能里的）用领主自己的参数启动，再按 region.mjs mechs 的判定解开（破招 / 水晶 / 撑过 / 护盾 / 光圈 / 分身 / 属性 / 连线……）
//   bot     机器人（各图自己的等级、全身 +12 史诗，同 region.mjs bot）从领主房门口打到领主倒下：用时 / 被击 / 死亡 / 到过的阶段 / 触发的机制
//   coop    2 个真实客户端（net_lib.mjs）组队进领主房：主机逐招强制放、逐阶段压血，队员这边的地面预警、机制启动、钩子事件一一对应（同 mp_bosses.mjs）
// 页面报错 = 失败。每个领主出一张总览图（每招 / 每个机制 / 每个阶段一格）：test/shots/boss/<地下城>.jpg；数据：test/shots/boss/<地下城>.json（各部分分开写，重跑只覆盖跑过的部分）
// --strict：再按 §4.5 验收（招牌 ≥2、每个伤害招式有预警且 0.9~1.6 秒、机器人用时在带内 / 被击上限（这次跑的几个职业取平均，验收用 BOTCLS=all）、0 死亡、每个阶段和机制在一场里都触发过）
// 环境变量：SPEED（默认 3）、BOTCLS（默认按地下城轮换职业；all = 每个开放职业各打一次；或 sword,gun）、GEAR / ENH / LV（同 region.mjs）、LIMIT（机器人游戏时间上限秒）、COOPLV
// 低优先级（nice 10）跑；all / 区域 / 超过 3 个图 / bot / coop 先拿全局测试锁（$TMPDIR/dawnbreak-tests.lock，和 quick.sh、test/affected.mjs 同一把，排队等），在它们里面跑时不重复拿；BOSS_NOLOCK=1 跳过
// P0-E 合进来以后自动用上：monForceSkill(m, id 或 spec)、bossPhaseSet(m, i)、MS_EVENTS（预警 / 机制事件）、BOSS_MECHS[id].test.solve(m, st, p, BH)（新机制自己的解法，可选）
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { launch, URL_BASE, openLists } from './lib.mjs';
import { BEST_KIT_SRC } from './lib_bestkit.mjs';
import { BOSS_SCAN_SRC } from '../tools/boss_inventory.mjs';

const OUT = 'test/shots/boss';
fs.mkdirSync(OUT, { recursive: true });
// 验收带（BOSS_PLAN §4.5，按 59 个领主的基线定：普通用时中位 21 秒 / P90 38，攻坚中位 41 / P90 43，被击 P90 10 / 11）：领主房用时（秒，各职业平均）、被击上限；死亡 0
export const BANDS = { normal: [20, 75], raid: [40, 150], hurt: { normal: 20, raid: 40 } };
const args = process.argv.slice(2), STRICT = args.includes('--strict'), pos = args.filter(a => !a.startsWith('--'));
const readJ = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };

/* ---------------- 基线表 ---------------- */
if (pos[0] === 'table') {
  const inv = readJ('docs/boss_inventory.json') || { dungeons: [] };
  const rows = [], med = L => { const s = [...L].sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)] : 0; }, pct = (L, q) => { const s = [...L].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.round((s.length - 1) * q))] : 0; };
  const T = { normal: [], raid: [] }, H = { normal: [], raid: [] };
  for (const d of inv.dungeons.filter(d => !d.abyss)) {
    const R = readJ(`${OUT}/${d.id}.json`) || {}, bots = Object.values(R.bot || {}).filter(b => b.done), b = d.boss, sk = R.skills || [];
    const kind = R.raid ? 'raid' : 'normal', times = bots.map(x => x.time), hurts = bots.map(x => x.hurt);
    if (times.length) { T[kind].push(times.reduce((a, c) => a + c, 0) / times.length); H[kind].push(hurts.reduce((a, c) => a + c, 0) / hurts.length); }
    const sim = d.dup && d.dup.mostSimilar && d.dup.mostSimilar[0], dm = sk.filter(s => s.kind === 'dmg');
    const tele = sk.length ? `${dm.filter(s => s.tele > 0).length}/${dm.length}` : '—', hit = sk.length ? `${dm.filter(s => s.hits > 0).length}/${dm.length}` : '—';
    const avg = L => Math.round(L.reduce((a, c) => a + c, 0) / L.length), span = L => (L.length ? `${avg(L)}（${Math.min(...L)}~${Math.max(...L)}）` : '—');
    rows.push(`| ${d.id} ${d.name} | ${b.name} | ${kind === 'raid' ? '攻坚' : '普通'} | ${b.moves}（${dm.length}） | ${b.mechSet.length ? b.mechSet.join(' ') : '—'} | ${(b.sig || []).length} | ${sim ? `${sim[0]} ${sim[1]}` : '—'} | ${tele} | ${hit} | ${span(times)} | ${span(hurts)} | ${bots.length ? Math.max(...bots.map(x => x.deaths)) : '—'} |`);
  }
  console.log(`机器人：各图自己的等级、全身 +12 史诗，从领主房门口打到领主倒下；${[...new Set(inv.dungeons.flatMap(d => Object.keys((readJ(`${OUT}/${d.id}.json`) || {}).bot || {})))].join(' / ')} 各打一次，用时 / 被击写“平均（最少~最多）”。招式 = 招式表的招数（其中伤害招式）；地面预警 / 打得中按伤害招式算。\n`);
  console.log('| 图 | 领主 | 类型 | 招式 | 机制 | 招牌 | 最相似 | 地面预警 | 打得中 | 领主房用时 s | 被击 | 死亡 |\n|---|---|---|---|---|---|---|---|---|---|---|---|\n' + rows.join('\n'));
  for (const k of ['normal', 'raid']) if (T[k].length) console.log(`\n${k === 'raid' ? '攻坚' : '普通'} ${T[k].length} 个：用时 中位 ${med(T[k]).toFixed(0)}s，P10 ${pct(T[k], 0.1).toFixed(0)}，P25 ${pct(T[k], 0.25).toFixed(0)}，P75 ${pct(T[k], 0.75).toFixed(0)}，P90 ${pct(T[k], 0.9).toFixed(0)}，最短 ${Math.min(...T[k]).toFixed(0)}，最长 ${Math.max(...T[k]).toFixed(0)}；被击 中位 ${med(H[k]).toFixed(0)}，P90 ${pct(H[k], 0.9).toFixed(0)}，最多 ${Math.max(...H[k]).toFixed(0)}`);
  process.exit(0);
}

// 什么都不写 = 快速样本（一个手写领主 + 一个 4 阶段区域领主，不跑机器人，约 40 秒）；全量要写 all
const target = pos[0] || 'graca,skasa_nest';
const parts = (pos[1] || (pos[0] ? 'data,phases,skills,mechs,bot' : 'data,phases,skills,mechs')).split(',');
const speed = +(process.env.SPEED || 3);

// 低优先级跑（浏览器子进程继承）；大一点的跑法（all / 区域 / 超过 3 个图 / 机器人 / 组队）先拿全局测试锁（和 quick.sh、test/affected.mjs 同一把），
// 已经在拿着锁的测试套件里（锁的 pid 是自己的祖先进程）就不再拿，免得自己等自己
try { if (os.getPriority() < 10) os.setPriority(10); } catch (e) { /* 改不了优先级就照常跑 */ }
const LOCK = path.join(os.tmpdir(), 'dawnbreak-tests.lock');
const ancestors = () => { const L = []; let p = process.ppid; for (let i = 0; i < 12 && p > 1; i++) { L.push(p); try { p = +execFileSync('ps', ['-o', 'ppid=', '-p', String(p)], { encoding: 'utf8' }).trim(); } catch (e) { break; } } return L; };
const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return false; } };
const big = target.split(',').some(x => /^(all|legacy|region)$/.test(x) || fs.existsSync(`src/content/regions/${x}.js`)) || target.split(',').length > 3 || parts.includes('bot') || parts.includes('coop');
let myLock = false;
if (big && !process.env.BOSS_NOLOCK) {
  let said = false;
  for (;;) {
    try { fs.mkdirSync(LOCK); fs.writeFileSync(path.join(LOCK, 'pid'), String(process.pid)); myLock = true; break; } catch (e) { /* 已被占用 */ }
    let pid = 0; try { pid = +(fs.readFileSync(path.join(LOCK, 'pid'), 'utf8').trim() || 0); } catch (e) { /* 刚被释放 */ }
    if (pid && ancestors().includes(pid)) break;
    if (pid && !alive(pid)) { fs.rmSync(LOCK, { recursive: true, force: true }); continue; }
    if (!said) { console.log(`另一套测试正在跑（pid ${pid}），排队等它结束……`); said = true; }
    await new Promise(r => setTimeout(r, 5000));
  }
}
const unlock = () => { if (!myLock) return; try { if (+fs.readFileSync(path.join(LOCK, 'pid'), 'utf8') === process.pid) fs.rmSync(LOCK, { recursive: true, force: true }); } catch (e) { /* 已释放 */ } };
process.on('exit', unlock); process.on('SIGINT', () => process.exit(130)); process.on('SIGTERM', () => process.exit(143));
let fail = 0, warnN = 0;
const check = (ok, msg) => { if (!ok) { fail++; console.log('✗', msg); } return ok; };
const soft = (ok, msg) => { if (!ok) { if (STRICT) { fail++; console.log('✗', msg); } else { warnN++; console.log('⚠', msg); } } return ok; };

// 页面里的工具：探针（预警 / 被击 / 投射物 / 召唤 / 机制启动 / 头顶警示）、传送到领主房、安抚领主（不自己出招、不走动）、逐招 / 逐机制 / 逐阶段、机器人、总览图
const PAGE_SRC = String.raw`(() => {
  if (window.BH) return;
  const BH = window.BH = { c: { tele: [], hurt: [], proj: 0, adds: [], mech: [], warn: 0 }, noDie: false };
  const C = BH.c;
  const t0 = telegraph; telegraph = function (o) { const g = t0.apply(this, arguments); C.tele.push({ t: game.t, kind: g.kind, r: Math.round(g.r || 0), dur: +(+g.dur || 0).toFixed(2), mech: g.mech || null }); return g; };
  const h0 = game.onPlayerHurt; game.onPlayerHurt = function (p, dmg, a) { const me = p === (game.realPlayer || game.player); if (me) C.hurt.push({ t: game.t, dmg: Math.round(dmg), src: (a && a.kind) || null, mech: typeof msNetSrc !== 'undefined' ? msNetSrc : null }); const r = h0.call(this, p, dmg, a); if (me && BH.noDie) { p.hp = p.hpMax; p.dead = false; } return r; };
  const sp0 = spawnProj; spawnProj = function (o) { if (o && o.owner && o.owner.team === 'e') C.proj++; return sp0.apply(this, arguments); };
  const sm0 = spawnMonster; spawnMonster = function (k) { const m = sm0.apply(this, arguments); if (m && m.team === 'e' && !m.boss) C.adds.push({ t: game.t, kind: k }); return m; };
  const ms0 = msMechStart; msMechStart = function (m, spec) { const st = ms0.apply(this, arguments); C.mech.push({ t: game.t, id: spec && spec.use }); return st; };
  const wm0 = warnMark; warnMark = function () { C.warn++; return wm0.apply(this, arguments); };
  const evList = () => { if (typeof MS_EVENTS === 'undefined' || !MS_EVENTS) return null; return Array.isArray(MS_EVENTS) ? MS_EVENTS : MS_EVENTS.list || MS_EVENTS.log || MS_EVENTS.events || null; };
  const evNorm = e => ({ type: String(e.type || e.ev || e.e || e.kind || '?'), id: String(e.id ?? e.mech ?? e.use ?? e.skill ?? e.h ?? ''), t: +(e.t ?? e.T ?? e.time ?? 0) });
  BH.hasEv = () => !!evList();
  BH.mark = () => { const E = evList(); return { tele: C.tele.length, hurt: C.hurt.length, proj: C.proj, adds: C.adds.length, mech: C.mech.length, warn: C.warn, t: game.t, ev: E ? E.length : 0 }; };
  BH.since = M => { const E = evList(), ev = E ? (E.length >= M.ev ? E.slice(M.ev) : E).map(evNorm) : null;
    return { tele: C.tele.slice(M.tele), hurt: C.hurt.slice(M.hurt), proj: C.proj - M.proj, adds: C.adds.slice(M.adds), mech: C.mech.slice(M.mech), warn: C.warn - M.warn, ev }; };
  BH.gw = s => new Promise(res => { const T = game.t + s, iv = setInterval(() => { if (game.t >= T || !game.dungeon) { clearInterval(iv); res(); } }, 16); });
  BH.boss = () => { const D = game.dungeon; return D && D.boss; };
  BH.kill = o => { if (!o || o.dead || o.remove) return; o.invul = 0; o.st = 'idle'; o.z = 0; o.hp = 1; if (o.msHidden) msHide(o, false); applyHit(game.player, o, { dmg: 50, sure: true }, { proj: true }); if (!o.dead) { o.hp = 0; killEnt(o, game.player, {}); } };
  BH.clearAdds = () => { const m = BH.boss(); for (let i = ents.length - 1; i >= 0; i--) { const e = ents[i]; if (e.team === 'e' && e !== m) ents.splice(i, 1); } };
  // 进图：各图自己的等级；gear = epic（同级最好史诗，BEST_KIT_SRC）/ rare / base / 默认全身史诗 +12（同 region.mjs bot）
  BH.enter = (did, o) => {
    const lv = o.lv || DUNGEONS[did].lvl[1], p = game.player, U = DUNGEONS[did].unlock; testLoadout(lv);
    if (U && U.quest) save.data.questDone[U.quest] = Date.now();
    const eq = [];
    if (o.gear === 'epic') { const lv0 = game.lvl; game.lvl = lv; const K = g60BestKit(lv); game.lvl = lv0; for (const s in K.bestKit) { const it = K.bestKit[s]; it.enh = o.enh; inv.equip[s] = it; eq.push(it.rar); } }
    else if (o.gear !== 'base') for (const s of Object.keys(SLOT_WEIGHT)) { const it = rollEquip({ slot: s, lvl: lv, rar: o.gear === 'rare' ? 2 : 5, cls: p.cls }) || inv.equip[s]; if (it) { it.enh = o.gear === 'rare' ? o.enh : 12; inv.equip[s] = it; eq.push(it.rar); } }
    recalcStats(p); p.hp = p.hpMax; p.mp = p.mpMax; save.data.fatigue = 999; save.data.coins = Math.max(save.data.coins || 0, 5);
    const ok = enterDungeon(did, 0);
    return { ok: ok !== false, lv, epics: eq.filter(r => r === 5).length, atk: Math.round(p.atk || 0), hp: p.hpMax };
  };
  // 传送到领主房（其余房间记成已清）
  BH.warp = () => { const dg = game.dungeon; for (const r of dg.layout.rooms) if (r.type !== 'boss') { r.visited = true; r.cleared = true; } dg.enter(dg.layout.boss, 'left'); const m = dg.boss; return m ? { kind: m.kind, hp: m.hpMax, x: Math.round(m.x) } : null; };
  // 安抚：领主照常跑 AI（阶段 / 机制 / 钩子都在 control 里），但不自己出招、不走动
  // lockHp：逐招 / 逐机制时领主血量每帧回满（打破招槽 / 护盾会掉血，掉到门槛会提前进阶段）
  BH.calm = () => { const m = BH.boss(); if (!m || m.__calm) return; m.__calm = true; const c0 = m.control;
    m.control = function (e, dt) { e.aiCd = Math.max(e.aiCd || 0, 30); if (BH.lockHp) e.hp = e.hpMax; if (c0) c0.call(this, e, dt); if (!e.busy) { e.vx = 0; e.vy = 0; } }; };
  BH.resetPlayer = () => { const p = game.player; if (p.heldBy) releaseHeld(p); if (p.act) p.endAct(); p.setState('idle'); p.z = 0; p.vx = p.vy = p.vz = 0; p.status = {}; p.invul = 0; p.grabProt = 0; p.dead = false; p.hp = p.hpMax; p.mp = p.mpMax; };
  BH.reset = (mechs) => { const m = BH.boss(); BH.clearAdds(); groundFx.length = 0; for (let i = projs.length - 1; i >= 0; i--) if (projs[i].team !== 'p') projs.splice(i, 1);
    if (m) { if (m.msHidden) msHide(m, false); if (m.act) m.endAct(); m.setState('idle'); m.stun = 0; m.invul = 0; m.z = 0; m.x = clamp(m.x, 420, game.room.x1 - 200); m.y = DEPTH / 2;
      if (mechs && m.msMechs) { for (const s of m.msMechs) if (mechs === 'all' || (s.id !== 'groggy' && s.id !== 'enrage')) msMechEnd(m, s); m.msMechs = m.msMechs.filter(s => !s.ended); if (mechs === 'all') { m.msMul = {}; m.dmgTakenMul = 1; } } }
    BH.resetPlayer(); };
  // 玩家站到第 i 招的出手距离里（near：贴身）
  BH.place = (i, near) => { const m = BH.boss(), A = m.def_.attacks[i], R = (A && A.range) || [0, 80], p = game.player, W = game.room.x1;
    const d = near ? Math.max(30, R[0] + 10) : clamp((R[0] + Math.min(R[1], 420)) / 2, 40, 420); let x = m.x - d; if (x < 40) x = m.x + d;
    p.x = clamp(x, 40, W - 40); p.y = m.y; p.face = m.x >= p.x ? 1 : -1; m.face = p.x >= m.x ? 1 : -1; return Math.round(d); };
  BH.atkInfo = () => { const m = BH.boss(); return m.def_.attacks.map((A, i) => ({ i, ms: A.ms || null, id: A.msId || null, clip: A.clip, range: A.range, hits: !!(A.act && A.act.hits && A.act.hits.length), dur: A.act ? +(A.act.dur || 0).toFixed(2) : 0, sa: !!(A.act && A.act.superArmor) })); };
  BH.force = i => { const m = BH.boss(); m.aiCd = 30; return monForceSkill(m, i); };
  BH.guardPoke = () => { const m = BH.boss(); if (m && m.act && m.act.msGuard) applyHit(game.player, m, { dmg: 1, sure: true, knock: 10, stun: 0.1 }, {}); };
  BH.snapReady = (M, t0) => { const n = C.tele.length > M.tele, h = C.hurt.length > M.hurt; return h || (n && game.t - C.tele[M.tele].t >= 0.25) || game.t - t0 >= 0.7; };
  BH.settle = (t0, minT, maxT) => new Promise(res => { const iv = setInterval(() => { const m = BH.boss(), dt = game.t - t0;
    const busy = (m && m.busy) || groundFx.some(g => !g.friendly && g.fire) || projs.some(q => q.team !== 'p');
    if ((dt >= minT && !busy) || dt >= maxT || !game.dungeon) { clearInterval(iv); res(+dt.toFixed(2)); } }, 16); });
  // 领主用到的机制 spec（出场 + 阶段进入 + 技能里的 use:'mech'），用领主自己的参数；按内容去重
  BH.mechSpecs = () => { const m = BH.boss(), D = m.def_, S = D.region && REGIONS[D.region] ? REGIONS[D.region].spec.bosses[m.kind] : null, src = S || {};
    const flat = (L, out = []) => { for (const s of L || []) { if (!s) continue; out.push(s); if (s.use === 'seq') flat(s.steps, out); if (s.then) flat([s.then], out); } return out; };
    const phases = src.phases || D.msPhases || [], sk = S ? flat([...(S.skills || []), ...phases.flatMap(P => P.skills || [])]) : [];
    const L = [...(src.mechs || D.msMechs || []).map(s => ({ s, from: '出场' })), ...phases.flatMap((P, i) => ((P.enter || {}).mechs || []).map(s => ({ s, from: '阶段 ' + i }))), ...sk.filter(s => s.use === 'mech' && s.mech).map(s => ({ s: s.mech, from: '技能' }))];
    const seen = new Set(); BH.mechL = L.filter(x => { const k = JSON.stringify(x.s); if (seen.has(k)) return false; seen.add(k); return true; });
    return BH.mechL.map(x => ({ use: x.s.use, from: x.from, say: x.s.say || '', known: !!BOSS_MECHS[x.s.use] })); };
  BH.mechStart = j => { const m = BH.boss(); BH.reset('all'); m.x = Math.round(game.room.x1 * 0.62); const x = BH.mechL[j]; BH.st = msMechStart(m, x.s); return { id: BH.st.id, hidden: !!m.msHidden, objs: (BH.st.objs || []).length }; };
  // 按 region.mjs mechs 的判定解开机制；新机制（P0-E）可以在 BOSS_MECHS[id].test.solve 里给自己的解法
  BH.mechSolve = async () => {
    const m = BH.boss(), st = BH.st, p = st.p, id = st.id, R = { id }, S = MS_STATS.mech, done = () => !!(st.ended || st.done);
    const hitBoss = (n, dmg = 20) => { let k = 0; for (; k < n && !done(); k++) { m.invul = 0; applyHit(game.player, m, { dmg, sure: true, knock: 0, stun: 0.05, hs: 0 }, { proj: true }); } return k; };
    const T = BOSS_MECHS[id] && BOSS_MECHS[id].test;
    BH.noDie = true;
    try {
      if (T && T.solve) { R.how = 'test.solve'; await T.solve(m, st, p, BH); await BH.gw(0.3); R.solved = done(); }
      else if (id === 'groggy') { const b0 = S.groggyBreak || 0; let n = 0; while (!(st.stun > 0) && n++ < 3000) hitBoss(1); R.hits = n; R.solved = (S.groggyBreak || 0) > b0 && m.msMul.groggy > 1; }
      else if (id === 'invuln') {
        await BH.gw(0.4); R.hidden = !!m.msHidden;
        if (p.until === 'survive') { const hp0 = m.hp; hitBoss(1, 40); R.noDmg = m.hp >= hp0; st.t = Math.max(st.t, p.survive - 0.3); }
        else if (p.until === 'hook') m.msInvulDone = true;
        else for (let k = 0; k < 4 && !done(); k++) { for (const o of st.objs || []) BH.kill(o); if (p.until === 'adds') for (const e of [...ents]) if (e.team === 'e' && e !== m && !e.dead && (!p.kind || e.kind === p.kind)) BH.kill(e); await BH.gw(0.5); }
        await BH.gw(0.6);
        // 领主自己的钩子也会藏起来（虫王钻地 2.2 秒后破土）：机制结束后再等它回到场上
        for (let k = 0; k < 10 && done() && m.msHidden; k++) await BH.gw(0.4);
        R.solved = done() && !m.msHidden; R.onField = ents.includes(m);
        if (!R.solved) R.left = (st.objs || []).filter(o => !o.dead && !o.remove).map(o => o.kind + ' hp' + Math.round(o.hp) + ' inv' + (o.invul > 0 ? 1 : 0) + ' ' + o.st + (ents.includes(o) ? '' : ' 不在场'));
      }
      else if (id === 'shield') { const hp0 = m.hp; hitBoss(1); R.blocked = m.hp >= hp0; let n = 0; while (!done() && n++ < 3000) hitBoss(1, 30); await BH.gw(0.2); R.solved = !!st.broken; }
      else if (id === 'safezone') {
        const pl = game.player, z = p.mode === 'zone' ? st.zones[0] : null, H0 = C.hurt.length, big = pl.hpMax * p.frac * 0.9;
        if (p.mode === 'zone') { pl.x = z.x; pl.y = z.y; } else if (p.mode === 'near') { pl.x = m.x - 20; pl.y = m.y; } else { pl.x = m.x < game.room.x1 / 2 ? game.room.x1 - 60 : 60; pl.y = DEPTH / 2; }
        pl.vx = pl.vy = 0; const s0 = S.safe || 0;
        const hold = setInterval(() => { if (p.mode === 'zone') { pl.x = z.x; pl.y = z.y; } }, 16);
        await BH.gw(p.windup + 0.4); clearInterval(hold);
        R.safe = (S.safe || 0) > s0; R.hurtInside = C.hurt.slice(H0).filter(h => h.dmg >= big).length; R.solved = R.safe && !R.hurtInside;
      }
      else if (id === 'hazard') {
        const n0 = C.tele.length, w0 = st.w; await BH.gw(p.kind === 'shrink' ? 1.0 : Math.min(3, (p.every || 4) + 1.6));
        R.effect = p.kind === 'shrink' ? +(w0 - st.w).toFixed(0) : C.tele.length - n0; R.solved = R.effect > 0; R.how = '持续伤害（看有没有预警 / 缩圈）'; msMechEnd(m, st);
      }
      else if (id === 'enrage') { const a0 = m.atk; st.t = Math.max(st.t, p.t - 0.2); await BH.gw(0.5); R.fired = !!st.fired; R.solved = R.fired && m.atk > a0 && m.msCdMul < 1; R.how = 'DPS 检查（快进到点看有没有狂暴）'; }
      else if (id === 'clones') { await BH.gw(0.6); R.shades = (st.shades || []).filter(o => !o.dead && !o.remove).length; hitBoss(1, 10); await BH.gw(0.4); R.solved = done() && (st.shades || []).every(o => o.dead || o.remove); }
      else if (id === 'element') {
        await BH.gw(0.3); const pl = game.player, z = st.zones.find(z => z.md !== p.modes[st.mode]); const wrong = m.dmgTakenMul;
        const hold = setInterval(() => { pl.x = z.x; pl.y = z.y; pl.vx = pl.vy = 0; }, 16); await BH.gw(0.4); clearInterval(hold);
        R.wrong = +wrong.toFixed(2); R.right = +(m.msMul.element ?? 1).toFixed(2); R.solved = R.right === 1 && R.wrong < 1; msMechEnd(m, st);
      }
      else if (id === 'tether') { await BH.gw(0.4); R.mul = +(m.dmgTakenMul || 1).toFixed(2); BH.kill(st.pt); await BH.gw(0.5); R.solved = done(); }
      else {
        R.how = '通用：打掉机制刷出的东西、打领主，等它结束';
        for (let k = 0; k < 12 && !done(); k++) { for (const o of [...(st.objs || []), ...(st.adds || []), st.pt].filter(Boolean)) BH.kill(o); for (const e of [...ents]) if (e.team === 'e' && e !== m && !e.dead && e.msObj) BH.kill(e); hitBoss(20, 30); await BH.gw(0.6); }
        R.solved = done();
      }
    } catch (e) { R.err = String(e && e.message || e); }
    if (!R.solved) R.diag = { done: !!st.done, ended: !!st.ended, hidden: !!m.msHidden, remove: !!m.remove, dead: !!m.dead, t: +st.t.toFixed(1), mechs: (m.msMechs || []).map(s => s.id + (s.done ? '(done)' : '')).join('/') };
    BH.noDie = false;
    if (!done()) msMechEnd(m, st);
    if (m.msHidden) msHide(m, false);
    return R;
  };
  // 阶段：P0-E 的 bossPhaseSet 优先，没有就把血量压到门槛下
  BH.phaseList = () => { const m = BH.boss(); return (m.def_.msPhases || []).map((P, i) => ({ i, at: P.at ?? 1, say: (P.enter || {}).say || '', mechs: ((P.enter || {}).mechs || []).map(s => s.use) })); };
  BH.phaseGo = i => { const m = BH.boss(), P = m.def_.msPhases[i]; if (typeof bossPhaseSet === 'function') { bossPhaseSet(m, i); return 'bossPhaseSet'; } m.hp = Math.max(1, Math.floor(m.hpMax * P.at) - 1); return 'hp'; };
  BH.phaseAfter = async i => { const m = BH.boss(), r = { want: i, got: m.msPhase, hidden: !!m.msHidden, mechs: (m.msMechs || []).filter(s => !s.done).map(s => s.id) };
    if (m.msHidden) { for (let k = 0; k < 6 && m.msHidden; k++) { for (const s of m.msMechs || []) if (s.id === 'invuln') { for (const o of s.objs || []) BH.kill(o); if (s.p.until === 'survive') s.t = Math.max(s.t, s.p.survive); if (s.p.until === 'hook') m.msInvulDone = true; } for (const e of [...ents]) if (e.team === 'e' && e !== m && !e.dead) BH.kill(e); await BH.gw(0.5); } r.back = !m.msHidden; }
    BH.clearAdds(); return r; };
  // 机器人：从领主房门口开始计时，领主倒下（bossDown）为止
  BH.botStart = () => { const D = game.dungeon; BH.b0 = { t: D.t, hurt: D.hurt, deaths: bot.deaths || 0, mech: { ...MS_STATS.mech }, cast: { ...MS_STATS.cast } }; BH.bossDown = null; BH.maxPhase = 0;
    const bd = D.bossDown.bind(D); D.bossDown = b => { BH.bossDown = { t: D.t, hurt: D.hurt, deaths: bot.deaths || 0 }; return bd(b); };
    bot.on = true; window.__botDone = null; };
  BH.botPoll = () => { const D = game.dungeon, m = D && D.boss; if (m && m.msPhase > BH.maxPhase) BH.maxPhase = m.msPhase; const b0 = BH.b0, e = BH.bossDown;
    const dm = {}; for (const k in MS_STATS.mech) { const v = MS_STATS.mech[k] - (b0.mech[k] || 0); if (v > 0) dm[k] = v; }
    const dc = {}; for (const k in MS_STATS.cast) { const v = MS_STATS.cast[k] - (b0.cast[k] || 0); if (v > 0) dc[k] = v; }
    return { done: !!e, time: e ? Math.round(e.t - b0.t) : D ? Math.round(D.t - b0.t) : null, hurt: e ? e.hurt - b0.hurt : D ? D.hurt - b0.hurt : null, deaths: (e ? e.deaths : bot.deaths || 0) - b0.deaths,
      bossHp: m ? Math.round(m.hp / m.hpMax * 100) : null, phase: BH.maxPhase, phases: m ? (m.def_.msPhases || []).length : 0, mech: dm, cast: dc, hp: Math.round(game.player.hp / game.player.hpMax * 100), state: D ? D.state : 'none' }; };
  // 总览图：每格一张截图 + 两行字，拼成一张 jpg（dataURL）
  BH.sheet = async (title, tiles) => {
    const TW = 384, TH = 180, LH = 40, cols = Math.min(4, Math.max(1, tiles.length)), rows = Math.ceil(tiles.length / cols);
    const cv = document.createElement('canvas'); cv.width = cols * TW + (cols + 1) * 6; cv.height = 44 + rows * (TH + LH + 6) + 6; const c = cv.getContext('2d');
    c.fillStyle = '#16121c'; c.fillRect(0, 0, cv.width, cv.height); c.fillStyle = '#ffe6a0'; c.font = 'bold 20px sans-serif'; c.textBaseline = 'top'; c.fillText(title, 10, 12);
    for (let i = 0; i < tiles.length; i++) {
      const T = tiles[i], x = 6 + (i % cols) * (TW + 6), y = 44 + Math.floor(i / cols) * (TH + LH + 6), im = new Image(); im.src = T.img; await im.decode();
      c.drawImage(im, x, y, TW, TH); c.fillStyle = T.bad ? '#4a1a1e' : '#221c2c'; c.fillRect(x, y + TH, TW, LH);
      c.fillStyle = T.bad ? '#ff9a9a' : '#e8e0f0'; c.font = '13px sans-serif'; c.fillText(T.l1.slice(0, 44), x + 6, y + TH + 4); c.fillStyle = '#b8b0c8'; c.fillText((T.l2 || '').slice(0, 52), x + 6, y + TH + 21);
    }
    return cv.toDataURL('image/jpeg', 0.8); };
})();`;

const { browser, page, logs } = await launch({ width: 1280, height: 720 });
const open = async q => {
  await page.goto(`${URL_BASE}?${q}`); await page.waitForFunction(() => window.__READY, null, { timeout: 60000 });
  await page.evaluate(s => { game.speedMul = s; for (const w of ['help', 'guide']) if (menus.isOpen(w)) menus.close(w); }, speed);
  await page.evaluate(BOSS_SCAN_SRC); await page.evaluate(PAGE_SRC);
};
const ev = (f, a) => page.evaluate(f, a);
const gameWait = s => page.evaluate(s => BH.gw(s), s);
const shot = async () => 'data:image/jpeg;base64,' + (await page.screenshot({ type: 'jpeg', quality: 70, clip: { x: 0, y: 0, width: 1280, height: 600 } })).toString('base64');
const errsSince = n => logs.slice(n).filter(l => l.type !== 'warning' && !/素材加载失败/.test(l.text));

await open('town&mute&cls=sword');
const CLS = (await openLists(page)).classes;
const ALL = await ev(() => Object.keys(DUNGEONS).filter(id => !DUNGEONS[id].abyss && !(typeof ABYSS !== 'undefined' && ABYSS[id]) && DUNGEONS[id].boss && MON[DUNGEONS[id].boss.kind]));
const LIST = await ev(({ t, ALL }) => {
  if (t === 'all') return ALL;
  const out = [];
  for (const x of t.split(',')) {
    if (x === 'legacy') out.push(...ALL.filter(id => !DUNGEONS[id].region));
    else if (x === 'region') out.push(...ALL.filter(id => DUNGEONS[id].region));
    else if (REGIONS[x]) out.push(...REGIONS[x].dungeons.filter(id => ALL.includes(id)));
    else if (DUNGEONS[x]) out.push(x);
    else { const d = ALL.find(id => DUNGEONS[id].boss.kind === x); out.push(d || '?' + x); }
  }
  return [...new Set(out)];
}, { t: target, ALL });
for (const d of LIST.filter(d => d.startsWith('?'))) check(false, `没有这个地下城 / 领主：${d.slice(1)}`);
const DGS = LIST.filter(d => !d.startsWith('?'));
console.log(`领主测试：${DGS.length} 个（${parts.join(',')}${STRICT ? '，--strict' : ''}）`);

const botCls = did => { const B = process.env.BOTCLS; if (B === 'all') return CLS; if (B) return B.split(','); return [CLS[Math.max(0, ALL.indexOf(did)) % CLS.length]]; };
const summary = [];
async function runOne(did) {
  const file = `${OUT}/${did}.json`, R = readJ(file) || { id: did }, L0 = logs.length, tiles = [];
  // ---- 数据 ----
  const info = await ev(did => { const D = DUNGEONS[did], k = D.boss.kind, S = bossScan(k), M = MON[k], E = [], W = [];
    const clipOk = c => !!(SPR_ANIMS.monster[c] || BEAST_CLIPS[c] || (M.clips && M.clips[c]));
    for (const A of M.attacks || []) if (!clipOk(A.clip)) { if (/^sig/.test(A.clip)) W.push(`招牌动作 ${A.clip} 还没有帧（SPR_ANIMS / 精灵覆盖）`); else E.push(`片段 ${A.clip} 不存在`); }
    if (!MON_ART[k] && !M.model && !M.customModel) E.push('没有 MON_ART / 模型');
    for (const b of monBundles([k])) if (!Object.values(ASSET_BUNDLE).includes(b)) E.push(`分包 ${b} 没有素材`);
    const P = M.msPhases || []; P.forEach((p, i) => { if (i && !(p.at < P[i - 1].at && p.at > 0)) E.push(`阶段 ${i} 的门槛 ${p.at} 不在 (0, 上一阶段)`); for (const s of (p.enter || {}).mechs || []) if (!BOSS_MECHS[s.use]) E.push(`阶段 ${i} 的机制 ${s.use} 不在机制库`); });
    for (const s of M.msMechs || []) if (!BOSS_MECHS[s.use]) E.push(`机制 ${s.use} 不在机制库`);
    if (M.hook && !REGION_HOOKS[M.hook]) E.push(`钩子 ${M.hook} 没有注册`);
    const SP = M.region && REGIONS[M.region] ? REGIONS[M.region].spec.bosses[k] : null, want = new Set();
    const walk = o => { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === 'object') { if ((o.use === 'summon' || o.use === 'tether' || o.use === 'plant' || (o.use === 'invuln' && o.until === 'adds') || o.use === 'duo' || o.use === 'gauntlet') && typeof o.kind === 'string') want.add(o.kind); for (const x in o) if (x !== 'kind') walk(o[x]); } };
    walk(SP ? [SP.skills, SP.phases, SP.mechs] : [M.msMechs, M.msPhases]);
    for (const x of want) if (!MON[x]) E.push(`召唤 / 搭档 ${x} 没有定义`);
    if (!(D.boss.lvl >= D.lvl[1])) W.push(`领主等级 ${D.boss.lvl} < 地下城最高等级 ${D.lvl[1]}`);
    const G = D.region && REGIONS[D.region].spec.dungeons[did], raid = S.tier === 'raid' || !!(G && G.layout === 'raid');
    return { kind: k, name: M.name, raid, scan: S, errs: E, warns: W, lv: D.lvl[1] };
  }, did);
  Object.assign(R, { kind: info.kind, name: info.name, raid: info.raid });
  const tag = `${did}（${info.name}）`;
  console.log(`\n== ${tag}：${info.scan.engine}，${info.scan.moves} 招，机制 ${info.scan.mechSet.join(' ') || '—'}，阶段 ${info.scan.phases.length}，招牌 ${info.scan.sig.length}${info.raid ? '，攻坚' : ''}`);
  if (parts.includes('data')) {
    for (const e of info.errs) check(false, `${tag} 数据：${e}`);
    for (const w of info.warns) soft(false, `${tag} 数据：${w}`);
    soft(info.scan.sig.length >= 2, `${tag} 招牌 ${info.scan.sig.length} 个 < 2（${info.scan.sig.map(s => s.name).join('、') || '无'}）`);
    R.data = { engine: info.scan.engine, moves: info.scan.moves, mechSet: info.scan.mechSet, phases: info.scan.phases.length, sig: info.scan.sig, errs: info.errs, warns: info.warns };
  }
  // ---- 领主房：逐招 / 逐机制 / 逐阶段 ----
  if (['skills', 'mechs', 'phases'].some(p => parts.includes(p))) {
    await open('town&mute&cls=sword');
    const st = await ev(did => BH.enter(did, { gear: 'base' }), did);
    const inDg = await page.waitForFunction(did => game.scene === 'dungeon' && game.dungeon && game.dungeon.def.id === did && !game.dungeon.transition, did, { timeout: 30000 }).then(() => true, () => false);
    if (!check(st.ok && inDg, `${tag} 进不了地下城`)) return;
    const w = await ev(() => BH.warp());
    await gameWait(0.4);
    if (!check(w, `${tag} 领主房没有领主`)) return;
    await ev(() => { BH.calm(); BH.lockHp = true; BH.reset(); const m = BH.boss(); m.x = Math.round(game.room.x1 * 0.62); window.__keepHp = setInterval(() => { const p = game.player; if (p.hp < p.hpMax * 0.5) p.hp = p.hpMax; p.mp = p.mpMax; }, 30); BH.noDie = true;
      const d = document.getElementById('dom'); if (d) d.style.visibility = 'hidden'; });
    const sprite = await ev(() => { const m = BH.boss(); return !!(m.def_.customModel || (m.model && m.model.constructor && m.model.constructor.name === 'SpriteModel')); });
    if (parts.includes('data')) check(sprite, `${tag} 领主没有逐帧精灵`);
    if (parts.includes('skills')) {
      const atk = await ev(() => BH.atkInfo()), rows = [];
      for (const A of atk) {
        let r = null;
        for (const near of [false, true]) {
          const dist = await ev(({ i, near }) => { BH.reset(true); return BH.place(i, near); }, { i: A.i, near });
          const M = await ev(() => BH.mark()), t0 = await ev(() => game.t);
          const forced = await ev(i => BH.force(i), A.i);
          if (A.ms === 'guard') { await gameWait(0.3); await ev(() => BH.guardPoke()); }
          await page.waitForFunction(({ M, t0 }) => BH.snapReady(M, t0), { M, t0 }, { timeout: 8000, polling: 30 }).catch(() => {});
          const img = await shot();
          const dur = await ev(({ t0, A }) => BH.settle(t0, Math.max(1.4, A.dur + 0.3), 6), { t0, A });
          const s = await ev(M => BH.since(M), M);
          const firstHit = s.hurt.length ? +(s.hurt[0].t - t0).toFixed(2) : null;
          r = { i: A.i, move: A.ms ? A.ms + (A.id ? '#' + A.id : '') : A.clip, clip: A.clip, forced, dist, near, tele: s.tele.length, teleDur: s.tele.length ? Math.max(...s.tele.map(g => g.dur)) : 0, hits: s.hurt.length, firstHit, dmg: s.hurt.reduce((a, h) => a + h.dmg, 0),
            proj: s.proj, adds: s.adds.length, mech: [...new Set(s.mech.map(x => x.id))], warn: s.warn, sa: A.sa, t: dur, ev: s.ev ? s.ev.length : null, img };
          const passive = ['summon', 'buff', 'blink', 'mech'].includes(A.ms) || (!A.hits && !r.tele && !r.proj && (r.adds || r.mech.length));
          r.kind = passive ? 'util' : 'dmg';
          if (r.hits || passive || !forced) break;
        }
        const lead = r.teleDur || r.firstHit || 0;
        rows.push(r);
        tiles.push({ img: r.img, bad: !r.forced || (r.kind === 'dmg' && !r.hits), l1: `${r.i}. ${r.move}${r.clip && r.clip !== r.move ? ' · ' + r.clip : ''}${r.sa ? ' · 霸体' : ''}`, l2: `预警 ${r.tele}${r.tele ? '（' + r.teleDur + 's）' : ''} · 命中 ${r.hits}${r.firstHit != null ? ' @' + r.firstHit + 's' : ''}${r.proj ? ' · 弹 ' + r.proj : ''}${r.adds ? ' · 召 ' + r.adds : ''}${r.mech.length ? ' · 机制 ' + r.mech.join('/') : ''}` });
        r.lead = lead;
        check(r.forced, `${tag} 第 ${r.i} 招 ${r.move} 强制放不出来`);
        if (r.forced && r.kind === 'dmg') {
          soft(r.hits > 0, `${tag} 第 ${r.i} 招 ${r.move} 站在出手距离里（${r.dist}）也没打中`);
          // 预警 = 地面预警的时长；没有地面预警就按头顶“!”到第一下命中的时间（领主每招都有“!”）
          if (STRICT && r.hits) soft(lead >= 0.9 && lead <= 1.6, `${tag} 第 ${r.i} 招 ${r.move} 预警 ${lead}s 不在 0.9~1.6 秒（${r.tele ? '地面预警' : '没有地面预警，按出手到命中'}）`);
        }
      }
      R.skills = rows.map(({ img, ...x }) => x);
      console.table(R.skills.map(x => ({ i: x.i, move: x.move, clip: x.clip, kind: x.kind, forced: x.forced, dist: x.dist, tele: x.tele, teleDur: x.teleDur, hits: x.hits, firstHit: x.firstHit, proj: x.proj, adds: x.adds, mech: x.mech.join('/') })));
    }
    if (parts.includes('mechs')) {
      const L = await ev(() => BH.mechSpecs()), rows = [];
      for (let j = 0; j < L.length; j++) {
        if (!check(L[j].known, `${tag} 机制 ${L[j].use} 不在机制库`)) continue;
        let s0 = null;
        try { s0 = await ev(j => BH.mechStart(j), j); } catch (e) { check(false, `${tag} 机制 ${L[j].use}（${L[j].from}）启动报错：${e.message.slice(0, 200)}`); continue; }
        await gameWait(0.5);
        const img = await shot();
        const r = await ev(() => BH.mechSolve());
        rows.push({ mech: L[j].use, from: L[j].from, ...s0, ...r });
        tiles.push({ img, bad: !r.solved, l1: `机制 ${L[j].use}（${L[j].from}）${L[j].say ? ' ' + L[j].say : ''}`, l2: `${r.solved ? '解开' : '没解开'}${r.how ? ' · ' + r.how : ''}${r.err ? ' · 报错 ' + r.err : ''}` });
        check(!r.err, `${tag} 机制 ${L[j].use} 解的时候报错：${r.err}`);
        const known = ['groggy', 'invuln', 'shield', 'safezone', 'hazard', 'enrage', 'clones', 'element', 'tether'].includes(r.id) || r.how === 'test.solve';
        (known ? check : soft)(r.solved, `${tag} 机制 ${L[j].use}（${L[j].from}）没有解开：${JSON.stringify(r)}`);
      }
      R.mechs = rows;
      if (rows.length) console.table(rows.map(x => ({ mech: x.mech, from: x.from, solved: x.solved, how: x.how || '', detail: JSON.stringify(Object.fromEntries(Object.entries(x).filter(([k]) => !['mech', 'from', 'solved', 'how', 'id'].includes(k)))).slice(0, 90) })));
    }
    if (parts.includes('phases')) {
      await ev(() => { BH.reset('all'); BH.lockHp = false; const m = BH.boss(); m.hp = m.hpMax; m.msPhase = 0; });
      const P = await ev(() => BH.phaseList()), rows = [];
      for (const ph of P.filter(p => p.i > 0)) {
        const M = await ev(() => BH.mark());
        const how = await ev(i => BH.phaseGo(i), ph.i);
        await page.waitForFunction(i => { const m = BH.boss(); return m && m.msPhase >= i; }, ph.i, { timeout: 6000, polling: 30 }).catch(() => {});
        await gameWait(0.5);
        const img = await shot();
        const started = (await ev(M => BH.since(M), M)).mech.map(x => x.id);
        const r = await ev(i => BH.phaseAfter(i), ph.i);
        rows.push({ ...r, at: ph.at, how, wantMechs: ph.mechs.join('/'), started: started.join('/') });
        tiles.push({ img, bad: r.got !== ph.i, l1: `阶段 ${ph.i}（血量 ${Math.round(ph.at * 100)}%）${ph.say ? ' ' + ph.say : ''}`, l2: `进了阶段 ${r.got} · 启动 ${started.join('/') || '—'}${r.hidden ? ' · 藏起来' + (r.back ? '→回来' : '→没回来') : ''}` });
        check(r.got === ph.i, `${tag} 血量压到 ${ph.at} 没进阶段 ${ph.i}（现在 ${r.got}）`);
        for (const u of ph.mechs) check(started.includes(u), `${tag} 阶段 ${ph.i} 的机制 ${u} 没有启动（启动了 ${started.join('/') || '—'}）`);
        if (r.hidden) check(r.back, `${tag} 阶段 ${ph.i} 领主藏起来以后解不开`);
      }
      R.phases = rows;
      if (rows.length) console.table(rows);
    }
    await ev(() => { clearInterval(window.__keepHp); BH.noDie = false; });
  }
  if (tiles.length) {
    const url = await ev(({ t, tiles }) => BH.sheet(t, tiles), { t: `${did} ${info.name}（${info.kind}）· ${info.scan.engine} · ${info.scan.moves} 招 · 机制 ${info.scan.mechSet.join(' ') || '—'} · 招牌 ${info.scan.sig.length}`, tiles });
    fs.writeFileSync(`${OUT}/${did}.jpg`, Buffer.from(url.split(',')[1], 'base64'));
  }
  // ---- 机器人 ----
  if (parts.includes('bot')) {
    R.bot ??= {};
    const runs = [];
    for (const cls of botCls(did)) {
      await open(`town&mute&cls=${cls}`);
      if (process.env.GEAR === 'epic') await page.evaluate(BEST_KIT_SRC);
      const st = await ev(({ did, o }) => BH.enter(did, o), { did, o: { gear: process.env.GEAR || '', enh: +(process.env.ENH || 7), lv: +(process.env.LV || 0) } });
      const inDg = await page.waitForFunction(did => game.scene === 'dungeon' && game.dungeon && game.dungeon.def.id === did && !game.dungeon.transition, did, { timeout: 30000 }).then(() => true, () => false);
      if (!check(st.ok && inDg, `${tag}（${cls}）机器人进不了地下城`)) continue;
      await ev(() => BH.warp());
      await ev(() => BH.botStart());
      const limit = +(process.env.LIMIT || (info.raid ? 600 : 400));
      let r = null, n = 0;
      for (;;) {
        await page.waitForTimeout(2000);
        r = await ev(() => BH.botPoll());
        if (r.done || r.time >= limit || r.state === 'failed' || r.state === 'none') break;
        if (n++ % 10 === 0) console.log(`  ${cls} ${r.time}s 领主 ${r.bossHp}% 阶段 ${r.phase}/${Math.max(0, r.phases - 1)} 被击 ${r.hurt} 死亡 ${r.deaths}`);
      }
      await page.screenshot({ path: `${OUT}/${did}-bot-${cls}.jpg`, type: 'jpeg', quality: 60 });
      R.bot[cls] = { cls, ...st, ...r, gear: process.env.GEAR || 'epic12', at: new Date().toISOString() };
      console.log(`  机器人 ${cls}：${r.done ? `${r.time}s 打倒` : `没打倒（${r.time}s，领主 ${r.bossHp}%）`}，被击 ${r.hurt}，死亡 ${r.deaths}，阶段 ${r.phase}/${Math.max(0, r.phases - 1)}，机制 ${JSON.stringify(r.mech)}`);
      check(r.done, `${tag}（${cls}）机器人 ${limit}s 内没打倒领主（领主 ${r.bossHp}%）`);
      check(r.deaths <= 2, `${tag}（${cls}）机器人死了 ${r.deaths} 次`);
      if (r.done) runs.push(r);
      if (r.done && STRICT) {
        soft(r.deaths === 0, `${tag}（${cls}）领主房死了 ${r.deaths} 次`);
        soft(r.phase >= Math.max(0, r.phases - 1), `${tag}（${cls}）只到了阶段 ${r.phase}/${r.phases - 1}`);
        for (const u of info.scan.mechSet) soft(r.mech[u] > 0, `${tag}（${cls}）机制 ${u} 一场里没触发`);
      }
    }
    // 用时 / 被击按这一次跑的几个职业取平均（史诗是随机的，单个职业波动大）；只在 --strict 时算验收
    if (runs.length && STRICT) {
      const avg = k => Math.round(runs.reduce((a, x) => a + x[k], 0) / runs.length), band = BANDS[info.raid ? 'raid' : 'normal'], hmax = BANDS.hurt[info.raid ? 'raid' : 'normal'];
      soft(avg('time') >= band[0] && avg('time') <= band[1], `${tag} 领主房用时 ${avg('time')}s（${runs.length} 个职业平均）不在 ${band[0]}~${band[1]} 秒`);
      soft(avg('hurt') <= hmax, `${tag} 领主房被击 ${avg('hurt')}（${runs.length} 个职业平均）> ${hmax}`);
    }
  }
  const pe = errsSince(L0);
  for (const e of pe.slice(0, 5)) console.log('ERR', e.text.slice(0, 300));
  check(!pe.length, `${tag} 页面报错 ${pe.length} 条`);
  const fe = await ev(() => (typeof frameErrs !== 'undefined' ? frameErrs.map(e => `${e.where} ×${e.n}：${e.msg}`) : []));
  check(!fe.length, `${tag} 逐帧报错：${fe.slice(0, 3).join('；')}`);
  R.updated = new Date().toISOString();
  fs.writeFileSync(file, JSON.stringify(R, null, 1));
  summary.push({ dungeon: did, boss: info.name, moves: info.scan.moves, sig: info.scan.sig.length, skills: R.skills ? `${R.skills.filter(s => s.tele).length}预警/${R.skills.filter(s => s.hits).length}命中/${R.skills.length}` : '', mechs: R.mechs ? `${R.mechs.filter(m => m.solved).length}/${R.mechs.length}` : '', phases: R.phases ? `${R.phases.filter(p => p.got === p.want).length}/${R.phases.length}` : '', bot: R.bot ? Object.values(R.bot).map(b => `${b.cls} ${b.done ? b.time + 's' : 'X'} 被击${b.hurt} 死${b.deaths}`).join('；') : '' });
}
for (const did of DGS) {
  try { await runOne(did); } catch (e) { check(false, `${did} 测试异常：${String(e && e.message || e).slice(0, 300)}`); }
}

/* ---------------- 组队（2 个客户端）---------------- */
if (parts.includes('coop') && DGS.length) {
  await browser.close();
  const { runCoop } = await import('./boss_coop.mjs');
  fail += await runCoop(DGS, { OUT, readJ });
} else await browser.close();

if (summary.length > 1) console.table(summary);
console.log(fail ? `boss: ${fail} 项失败${warnN ? `，${warnN} 项提醒` : ''}` : `boss: 全部通过${warnN ? `（${warnN} 项提醒，--strict 时算失败）` : ''}`);
process.exit(fail ? 1 : 0);
