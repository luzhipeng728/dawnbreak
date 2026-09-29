// 技能范围格子体检：人物站在 x=300，木桩摆成 17 列（身后 400 到身前 900）× 5 行（纵深 ±90），每个技能放一次，记下打到了哪些格子，
// 用来量“判定区到底有多大”（官方比例尺见 docs/SKILLS_OFFICIAL_mage.md 1.5 节：官方 1px = 本作 1 个世界单位）。
// 施放流程（蓄力 / 追加 / pre / presses / set / learn 等规格输入）照搬 test/skillaudit.mjs，读 docs/skills/<职业>.json 里的输入写法。
// 用法：node build.mjs --offline && node tools/skillgrid.mjs mage:elemental,mage:summoner [--only id1,id2] [--tag=before]
// 输出：终端每个技能一行（打到的格子数、x 范围、y 范围）+ test/shots/range/<职业>-<转职>[-标签].json（含每行的命中图 map：# = 打到，| = 身前 60 那一列）
import { launch, URL_BASE } from '../test/lib.mjs';
import fs from 'fs';

const args = process.argv.slice(2), opt = {}, pos = [];
for (const a of args) { if (a.startsWith('--')) { const [k, v] = a.slice(2).split('='); opt[k] = v ?? true; } else pos.push(a); }
const list = (pos[0] || 'sword').split(',');
const only = opt.only ? new Set(opt.only.split(',')) : null;
const SETUPS = (opt.setups || 'light,heavy,air,spread').split(',');
const out = 'test/shots/range'; fs.mkdirSync(out, { recursive: true });
const specCache = {};
function specOf(cls) {
  if (specCache[cls] !== undefined) return specCache[cls];
  const f = typeof opt.compare === 'string' ? opt.compare : `docs/skills/${cls}.json`;
  specCache[cls] = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
  return specCache[cls];
}

// ---------------- 页面里的测量代码 ----------------
function pageInit() {
  game.paused = true;
  const p = game.player;
  window.AUD = {};
  const A = window.AUD;
  A.step = n => { for (let i = 0; i < n; i++) step(1 / 60); };
  // 命中记录：包一层全局 applyHit（所有来源：动作 / 投射物 / 召唤物 / 地面效果都走它）
  const orig = window.applyHit;
  window.applyHit = function (a, t, h, o) {
    const pre = t && t.__aud ? { st: t.st, z: t.z, vz: t.vz } : null;
    const r = orig.apply(this, arguments);
    if (pre && r) {
      const air0 = pre.st === 'air' || pre.z > 2, air1 = t.st === 'air';
      const src = o && o.proj ? (o.src && o.src.skey ? 'summon' : 'proj') : a && a.summon ? 'summon' : a === game.player ? 'act' : 'other';
      A.hits.push({ d: t.__aud, t: +(A.t).toFixed(3), src, air0, st0: pre.st, st1: t.st, vz: Math.round(t.vz), dvz: Math.round(t.vz - (air0 ? pre.vz : 0)),
        launch: !air0 && pre.st !== 'down' && air1 && t.vz > 0, relaunch: air0 && air1 && t.vz > Math.max(0, pre.vz) + 40, held: t.st === 'held', otg: pre.st === 'down',
        f: [h.launch && 'L', h.down && 'D', h.grab && 'G', h.bounce && 'B', h.spike && 'S', h.downHit && 'O', h.throwHit && 'T'].filter(Boolean).join('') });
      if (t.__float) { t.gravMul = 1; t.__float = false; }
    }
    return r;
  };
  // 固定随机数（每次施放从同一个种子开始），结果可复现
  A.seed = n => { let a = n >>> 0; Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  A.reset = () => {
    for (const k in input.virt) delete input.virt[k];
    input.buf.length = 0; input.dirHist.length = 0; input.down.clear();
    if (typeof clearAllSummons === 'function') clearAllSummons('audit');
    for (const e of ents) if (e !== p) e.remove = true;
    game.timeStop = 0; game.cutin = null; game.timers.length = 0;
    A.step(1);
    projs.length = 0; groundFx.length = 0;
    Object.assign(p, { x: 300, y: 100, z: 0, vx: 0, vy: 0, vz: 0, face: 1, act: null, invul: 0, superArmor: 0, hitstop: 0, dead: false, cool: {}, buffs: {}, charges: {}, bsCd: 0, stun: 0, grabbed: null, chasers: [] });
    p.mpMax = Math.max(p.mpMax, 99999); p.hp = p.hpMax; p.mp = p.mpMax; p.setState('idle'); resetCmb(p);
    A.step(2);
  };
  A.dummy = (kind, x, y, tag) => {
    const m = spawnMonster(kind, x, y); m.control = null; m.act = null; m.hp = m.hpMax = 1e9; m.invul = 0; m.evade = 0; m.z = 0; m.vz = 0; m.face = -1; m.setState('idle');
    m.__aud = tag; m.__x0 = x; return m;
  };
  A.tap = k => { input.virt[k] = 2; };
  A.castPre = (id) => {   // 前置技能：放出来并等到动作结束
    game.skillBar[1] = id; A.tap('s1'); A.step(1); delete input.virt.s1;
    for (let i = 0; i < 240 && p.st === 'act'; i++) A.step(1);
    A.step(6); game.skillBar[1] = null;
  };
  // 施放一次并测量
  A.run = (id, setup, o) => {
    const S = SKILLS[id]; A.seed(0x5eed); A.reset();
    for (let i = 0; i < game.skillBar.length; i++) game.skillBar[i] = null;
    game.skillBar[0] = id;
    for (const pid of o.pre || []) A.castPre(pid);
    for (const e of ents) if (e !== p && !e.summon) e.remove = true;
    A.step(1); projs.length = 0;
    Object.assign(p, { x: 300, y: 100, vx: 0, vy: 0, face: 1, cool: {}, invul: 0, superArmor: 0 }); p.mp = p.mpMax; p.hp = p.hpMax * (o.hp || 1);
    const setK = o.set || {}, setOld = {}; for (const k in setK) { setOld[k] = p[k]; p[k] = setK[k]; }   // 规格的 set：施放前改人物字段（结束后还原）
    const learnK = o.learn || {}, learnOld = {}; for (const k in learnK) { learnOld[k] = game.skillLv[k]; game.skillLv[k] = learnK[k]; }   // 规格的 learn：施放前改技能等级（例：不学改形态的被动，量原版形态）
    const unset = () => { for (const k in setOld) { if (setOld[k] === undefined) delete p[k]; else p[k] = setOld[k]; } for (const k in learnOld) game.skillLv[k] = learnOld[k]; };
    const D = [];
    if (setup === 'light') D.push(A.dummy('goblin', 300 + (o.at || 70), 100, 'main'));
    else if (setup === 'heavy') D.push(A.dummy('tauBeast', 310 + (o.at || 70), 100, 'main'));
    else if (setup === 'air') { const m = A.dummy('goblin', 300 + (o.at || 70), 100, 'main'); m.setState('air'); m.z = 70; m.vz = 0; m.gravMul = 0.05; m.__float = true; D.push(m); }
    else if (setup === 'grid') { for (const dy of [-90, -45, 0, 45, 90]) for (const dx of [-400, -300, -200, -120, -60, 60, 120, 180, 240, 300, 380, 460, 540, 620, 700, 800, 900]) D.push(A.dummy('goblin', 300 + dx, 100 + dy, dx + ',' + dy)); }
    else for (const dx of [-80, 70, 170, 300, 450]) D.push(A.dummy('goblin', 300 + dx, 100, String(dx)));
    if (S.airOnly || o.air) { p.vz = 420; p.z = 1; p.setState('jump'); A.step(o.airDelay ?? 8); }
    if (typeof S.whenHit === 'function' ? S.whenHit(p) : S.whenHit) { p.setState('hit'); p.stun = 0.8; p.hurtT = game.t; }
    if (S.req) { const r = S.req(p); if (r !== true) { unset(); return { skip: 'req:' + r }; } }
    A.hits = []; A.t = 0;
    const x0 = p.x, y0 = p.y, mp0 = p.mp, seenS = new Set(SUMMONS), seenP = new WeakSet(projs), seenG = new WeakSet(groundFx);
    const R = { actF: 0, saF: 0, invF: 0, acts: 0, zMax: 0, summons: 0, projs: 0, fields: 0, err: null };
    const dm = {}; for (const d of D) dm[d.__aud] = { zMax: 0, down: false, held: false, bounce: 0, downT: null, x0: d.x, nb: d.cmb.bounce || 0, bn: 0 };
    const dirKey = o.dir === 'f' ? 'right' : o.dir === 'b' ? 'left' : null;
    const maxF = Math.round((o.watch || 8) * 60), minF = Math.round((o.minWatch || 0) * 60), presses = (o.presses || []).map(t => Math.round(t * 60));
    let lastAct = null, lastMine = -1, cdReal = null, mpUsed = null, endPos = null, followed = new WeakSet(), morph = null, instant = !!S.instant, f = 0;
    A.tap('s0'); if (dirKey) input.virt[dirKey] = 1;
    try {
      for (f = 0; f < maxF; f++) {
        A.t = f / 60;
        const a0 = p.act, mine0 = p.st === 'act' && a0 && (a0.skill === id || a0.skill === morph);
        // ---- 输入 ----
        if (f > 0) {
          const mode = o.input || 'tap';
          if (presses.includes(f)) A.tap('s0');
          else if (mode === 'hold') { if (A.t < (o.holdT || 4) && (mine0 || f < 3)) input.virt.s0 = 1; else delete input.virt.s0; }
          else if (mode === 'mash') { if (mine0 && A.t < (o.mashT || 6) && f % 6 === 0) A.tap('s0'); else if (input.virt.s0 !== 2) delete input.virt.s0; }
          else if (mine0 && a0.charge && !a0.chargeDone && !(a0.chargeT >= a0.charge.max)) input.virt.s0 = 1;   // 蓄满就松开（移动施法的蓄气蓄满后按住会一直保持）
          else if (mine0 && a0.follow && a0.followWin && p.actT >= a0.followWin[0] + 0.6 * ((a0.followWin[1] ?? a0.dur) - a0.followWin[0]) && !followed.has(a0)) { followed.add(a0); A.tap('s0'); }   // 追加：在窗口后段再按（正常节奏，不截断当前段的多段判定）
          else if (input.virt.s0 !== 2) delete input.virt.s0;
        }
        step(1 / 60);
        // ---- 采样 ----
        if (f === 0 && p.act && p.act.skill && p.act.skill !== id && S.morph) morph = p.act.skill;
        if (cdReal === null && ((p.cool[id] || 0) > 0 || (morph && (p.cool[morph] || 0) > 0))) { cdReal = +Math.max(p.cool[id] || 0, (morph && p.cool[morph]) || 0).toFixed(2); mpUsed = Math.round(mp0 - p.mp); }
        const a = p.act, mine = p.st === 'act' && a && (a.skill === id || a.skill === morph);
        if (mine) {
          R.actF++; lastMine = f;
          if (p.superArmor > 0 || a.superArmor === true) R.saF++;
          if (p.invul > 0) R.invF++;
          if (a !== lastAct) { R.acts++; lastAct = a; }
        } else if (lastMine >= 0 && !endPos) endPos = { dx: Math.round((p.x - x0)), dy: Math.round(p.y - y0) };
        R.zMax = Math.max(R.zMax, p.z);
        for (const s of SUMMONS) if (!seenS.has(s)) { seenS.add(s); if (s.owner === p) R.summons++; }
        for (const q of projs) if (q && !seenP.has(q)) { seenP.add(q); if (q.owner === p || (q.owner && q.owner.owner === p)) R.projs++; }
        for (const g of groundFx) if (g && !seenG.has(g)) { seenG.add(g); R.fields++; }
        for (const d of D) {
          const m = dm[d.__aud];
          m.zMax = Math.max(m.zMax, d.z);
          if (d.st === 'down' && !m.down) { m.down = true; m.downT = +A.t.toFixed(2); }
          if (d.st === 'held') m.held = true;
          const nb = d.cmb.bounce || 0; if (nb > m.nb) { if (m.bn) m.bounce++; m.nb = nb; }
          m.bn = d.bounceNext || 0;
        }
        // 结束：技能动作结束 1 秒后，木桩落地、没有自己的投射物、召唤物都走了（或到观察上限）
        const busy = mine || (lastMine < 0 && f < 30) || f < minF || D.some(d => d.st === 'air' || d.st === 'held' || d.z > 1) || projs.some(q => q && q.owner === p) || SUMMONS.some(s => s.owner === p && !s.gone && s.life < 60)
          || game.timers.length > 0 || groundFx.some(g => g && g.t < g.dur);   // 延迟伤害（game.after / 地面效果）还没结算完
        if (!busy && f - Math.max(lastMine, 0) > 60) break;
      }
    } catch (e) { R.err = String(e && e.message || e).slice(0, 120); }
    for (const k in input.virt) delete input.virt[k];
    unset();
    if (!endPos) endPos = { dx: Math.round(p.x - x0), dy: Math.round(p.y - y0) };
    const res = { cast: R.actF > 0 || instant, instant, acts: R.acts, dur: +(R.actF / 60).toFixed(2), sa: R.actF ? +(R.saF / R.actF).toFixed(2) : 0, invul: R.actF ? +(R.invF / R.actF).toFixed(2) : 0,
      dx: endPos.dx, dy: endPos.dy, zMax: Math.round(R.zMax), cd: cdReal, mp: mpUsed, summons: R.summons, projs: R.projs, fields: R.fields, watchT: +(f / 60).toFixed(2), err: R.err, morph };
    const byD = {};
    for (const d of D) {
      const m = dm[d.__aud], H = A.hits.filter(h => h.d === d.__aud);
      byD[d.__aud] = { hits: H.length, hitT: H.slice(0, 80).map(h => h.t), src: H.reduce((s, h) => (s[h.src] = (s[h.src] || 0) + 1, s), {}),
        zMax: Math.round(m.zMax), launch: H.filter(h => h.launch).length, relaunch: H.filter(h => h.relaunch && h.vz >= 250).length, airHits: H.filter(h => h.air0).length,
        maxVz: H.reduce((v, h) => Math.max(v, h.st1 === 'air' ? h.vz : 0), 0), down: m.down, downT: m.downT, otg: H.filter(h => h.otg).length, bounce: m.bounce, grab: m.held,
        push: Math.round((d.x - m.x0) * (d.__x0 >= 300 ? 1 : -1)), flags: [...new Set(H.map(h => h.f).join(''))].join('') };
    }
    if (setup === 'grid') { res.grid = Object.fromEntries(Object.entries(byD).filter(([k, v]) => v.hits > 0).map(([k, v]) => [k, v.hits])); return res; }
    if (setup === 'spread') { res.spread = Object.fromEntries(Object.entries(byD).map(([k, v]) => [k, v.hits])); res.pulled = Object.values(byD).filter(v => v.push <= -30).length; }
    else Object.assign(res, byD.main);
    return res;
  };
  A.skills = (cls, job) => {
    game.job = job || null; Object.assign((save.data.flags ??= {}), { awaken: true, awaken2: true, awaken3: true });
    if (job) try { onJobChange(p, job); } catch (e) { /* 部分转职没有这个钩子 */ }
    const all = classSkills(cls, job);
    for (const id of all) { const S = SKILLS[id]; if (S) game.skillLv[id] = S.maxLv || (S.passive ? 1 : 10); }
    if (typeof recalcStats === 'function') recalcStats(p);
    A.step(20);
    return all.filter(id => SKILLS[id] && (SKILLS[id].act || SKILLS[id].instant) && !SKILLS[id].passive).map(id => {
      const S = SKILLS[id]; let a = {}; try { a = typeof S.act === 'function' ? S.act(game.skillLv[id], p) || {} : {}; } catch (e) { a = {}; }
      return { id, name: S.name, job: S.job || null, cd: S.cd, mp: S.mp, type: S.type || null, elem: S.elem || null, lvReq: S.lvReq, awaken: !!S.awaken,
        st: { dur: a.dur ?? null, boxes: (a.hits || []).length, sa: a.superArmor ?? null, invul: a.invul ?? null, charge: !!a.charge, follow: !!a.follow, noSA: !!(S.noSA || a.noSA), grab: (a.hits || []).some(h => h.grab), atkCancel: !!(a.chain && a.next && !a.basic) } };
    });
  };
}

// ---------------- 规格对比 ----------------
// 规格字段（每个都可省略，省略就不查）：
//   hits [最少, 最多]（轻木桩总命中）  launch true/false（轻木桩被打到 ≥40px 高）  relaunch true（悬空木桩被追加浮空）
//   down true/false（轻木桩倒地）  bounce true（强制弹地）  grab true/false（抓住轻木桩）
//   sa / invul：'none'（<10%）| 'part'（10%–85%）| 'full'（≥85%）| 'any'   dx [最少, 最多]（向前位移 px，负数 = 后退）
//   behind true/false（打到身后 80px 的木桩）  reach [最少, 最多]（打到的最远木桩：70 / 170 / 300 / 450）
//   pull true/false（一排木桩里有被拉近 ≥30px 的）  cd 秒（和技能定义的冷却比，±25% 或 ±1 秒以内算一致）  summon true（放出召唤物 / 阵）  acts [最少, 最多]（段数：追加 / 再按的动作数）
//   dur [最少, 最多]（技能动作总时长，秒）  atkCancel true/false（后摇可以按普攻取消：技能动作带 chain / next）  why: { 字段: '理由' }：有理由的不一致算“已说明”，不算失败
const inR = (v, r) => Array.isArray(r) ? v >= r[0] && v <= r[1] : v === r;
const band = x => x >= 0.85 ? 'full' : x >= 0.1 ? 'part' : 'none';
function compare(sp, st, R) {
  const L = R.light || {}, AI = R.air || {}, SP = (R.spread || {}).spread || {}, mm = [];
  const chk = (k, ok, got) => { if (sp[k] === undefined || ok) return; mm.push({ k, want: sp[k], got, why: sp.why && sp.why[k] }); };
  if (L.skip || !L.cast) { if (sp.hits || sp.launch !== undefined) mm.push({ k: 'cast', want: true, got: L.skip || '放不出', why: sp.why && sp.why.cast }); return mm; }
  chk('hits', inR(L.hits, sp.hits), L.hits);
  chk('launch', (L.zMax >= 40) === sp.launch, `zMax ${L.zMax}`);
  chk('relaunch', (AI.relaunch > 0) === sp.relaunch, `relaunch ${AI.relaunch} maxVz ${AI.maxVz}`);
  chk('down', !!L.down === sp.down, L.down);
  chk('bounce', (L.bounce > 0 || (AI.bounce || 0) > 0) === sp.bounce, L.bounce);
  chk('grab', !!L.grab === sp.grab, L.grab);
  if (sp.sa !== 'any') chk('sa', band(L.sa) === sp.sa, `${band(L.sa)} ${L.sa}`);
  if (sp.invul !== 'any') chk('invul', band(L.invul) === sp.invul, `${band(L.invul)} ${L.invul}`);
  chk('dx', inR(L.dx, sp.dx), L.dx);
  chk('behind', ((SP['-80'] || 0) > 0) === sp.behind, SP['-80']);
  const reach = Math.max(0, ...['70', '170', '300', '450'].filter(k => (SP[k] || 0) > 0).map(Number));
  chk('reach', inR(reach, sp.reach), reach);
  chk('cd', st.cd !== undefined && Math.abs(st.cd - sp.cd) <= Math.max(1, sp.cd * 0.25), st.cd);
  chk('summon', (L.summons > 0) === sp.summon, L.summons);
  chk('pull', ((R.spread || {}).pulled > 0) === sp.pull, `被拉近的木桩 ${(R.spread || {}).pulled}`);
  chk('acts', inR(L.acts, sp.acts), L.acts);
  chk('atkCancel', !!(st.st && st.st.atkCancel) === sp.atkCancel, !!(st.st && st.st.atkCancel));
  chk('dur', inR(L.dur, sp.dur), L.dur);
  return mm;
}

// ---------------- 主流程 ----------------

const { browser, page, logs } = await launch({ width: 960, height: 540 });
const DXS = [-400, -300, -200, -120, -60, 60, 120, 180, 240, 300, 380, 460, 540, 620, 700, 800, 900], DYS = [-90, -45, 0, 45, 90];
for (const item of list) {
  const [cls, job] = item.split(':'), tag = `${cls}-${job || 'base'}`;
  await page.goto(`${URL_BASE}?test&mute&cls=${cls}&mobs=0`); await page.waitForFunction(() => window.__READY, null, { timeout: 30000 });
  await page.evaluate(pageInit);
  const spec = specOf(cls), specS = (spec && spec.skills) || {};
  const all = await page.evaluate(({ cls, job }) => AUD.skills(cls, job), { cls, job });
  const skills = all.filter(s => (!only || only.has(s.id)) && (job ? s.job === job || specS[`${s.id}@${job}`] : true));
  const res = {};
  for (const s of skills) {
    const sp = specS[`${s.id}@${job}`] || specS[s.id] || {};
    const o = { pre: sp.pre, hp: sp.hp, input: sp.input, holdT: sp.holdT, mashT: sp.mashT, dir: sp.dir, presses: sp.presses, watch: sp.watch, minWatch: sp.minWatch, air: sp.air, at: sp.at, airDelay: sp.airDelay, set: sp.set, learn: sp.learn };
    const R = await page.evaluate(({ id, o }) => AUD.run(id, 'grid', o), { id: s.id, o });
    const G = R.grid || {}, keys = Object.keys(G).map(k => k.split(',').map(Number));
    const row0 = keys.filter(k => k[1] === 0).map(k => k[0]);
    const fwd = keys.length ? Math.max(...keys.map(k => k[0])) : null, back = keys.length ? Math.min(...keys.map(k => k[0])) : null;
    const ys = [...new Set(keys.map(k => k[1]))].sort((a, b) => a - b);
    const map = DYS.map(dy => DXS.map(dx => G[dx + ',' + dy] ? '#' : (dx === 60 ? '|' : '.')).join('')).join(' / ');
    res[s.id] = { name: s.name, n: keys.length, fwd, back, ys: ys.length ? [ys[0], ys[ys.length - 1]] : null, row0: row0.length ? [Math.min(...row0), Math.max(...row0)] : null, map, skip: R.skip, err: R.err };
    console.log(`${s.id.padEnd(16)} ${String(s.name).padEnd(10).slice(0, 10)} n=${String(keys.length).padStart(2)} x[${back},${fwd}] y[${ys.length ? ys[0] + ',' + ys[ys.length - 1] : '-'}] ${R.skip ? 'SKIP ' + R.skip : ''}${R.err ? 'ERR ' + R.err : ''}`);
  }
  fs.writeFileSync(`${out}/${tag}${opt.tag ? '-' + opt.tag : ''}.json`, JSON.stringify(res, null, 1));
  const errs = logs.filter(l => l.type === 'pageerror'); if (errs.length) { console.log('  page error: ' + errs[0].text.slice(0, 160)); logs.length = 0; }
}
await browser.close();
