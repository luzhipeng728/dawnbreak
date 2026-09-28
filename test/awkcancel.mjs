// 觉醒取消（官方现版：普攻和大部分技能施放中途都能直接切入一 / 二 / 三觉）：逐帧推进（暂停循环、确定性）
// 对每个转职：普攻第 1 段中途 → 觉醒；每个非觉醒主动技能放到约 30% 时 → 觉醒（一 / 二 / 三觉轮流）；觉醒中再按另一个觉醒 → 不能打断
// 检查：觉醒真的切进来了、旧技能收尾后没有残留（人物回到站立、在地面、重力 / 隐身 / 抓取之类的字段复原）、没有页面报错
// 用法：node test/awkcancel.mjs [sword:blade,gun:ranger,...]（默认 15 个转职全跑）
import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';

const ALL = ['sword:blade', 'sword:berserker', 'sword:asura', 'sword:soulbender', 'sword:ghostblade', 'gun:ranger', 'gun:launcher', 'gun:spitfire', 'gun:mechanic', 'gun:paramedic',
  'mage:elemental', 'mage:battlemage', 'mage:summoner', 'mage:witch', 'mage:enchantress'];
const list = process.argv[2] ? process.argv[2].split(',') : ALL;

function pageInit() {
  game.paused = true; window.toastMsg = () => {};
  const p = game.player, A = window.AWK = {};
  A.step = n => { for (let i = 0; i < n; i++) step(1 / 60); };
  A.seed = n => { let a = n >>> 0; Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  A.tap = k => { input.virt[k] = 2; };
  A.reset = () => {
    for (const k in input.virt) delete input.virt[k];
    input.buf.length = 0; input.dirHist.length = 0; input.down.clear();
    if (typeof clearAllSummons === 'function') clearAllSummons('audit');
    for (const e of ents) if (e !== p) e.remove = true;
    if (p.act) p.interrupt();
    game.timeStop = 0; game.cutin = null; game.timers.length = 0;
    A.step(1); projs.length = 0; groundFx.length = 0;
    // 人物字段复原到转职设置好时的样子（上一次的变身 / 开关 / 召唤状态不带进下一次）
    if (A.base0) { for (const k of Object.keys(p)) if (!A.keys0.has(k) && typeof p[k] !== 'function') delete p[k]; for (const k in A.base0) p[k] = A.base0[k]; }
    Object.assign(p, { x: 300, y: 100, z: 0, vx: 0, vy: 0, vz: 0, face: 1, act: null, invul: 0, superArmor: 0, hitstop: 0, dead: false, cool: {}, buffs: {}, charges: {}, bsCd: 0, stun: 0, grabbed: null, chasers: [] });
    p.mpMax = Math.max(p.mpMax, 99999); p.hp = p.hpMax; p.mp = p.mpMax; p.setState('idle'); resetCmb(p);
    for (let i = 0; i < game.skillBar.length; i++) game.skillBar[i] = null;
    A.step(2);
    const m = spawnMonster('goblin', 370, 100); m.control = null; m.act = null; m.hp = m.hpMax = 1e9; m.invul = 0; m.evade = 0; m.face = -1; m.setState('idle');
  };
  // 人物身上会被技能临时改动的字段：结束后应该复原
  A.snap = () => ({ ...Object.fromEntries(Object.keys(p).filter(k => typeof p[k] === 'boolean' && !/^(remove|dead|grounded|jumpRun|techHold|bounced|hitHeavy)$/.test(k)).map(k => ['b.' + k, p[k]])), st: p.st, z: Math.round(p.z), gravMul: p.gravMul ?? 1, hidden: !!p.hidden, noGrab: !!p.noGrab, ghost: !!p.ghost, alpha: p.alpha ?? 1, timeStop: game.timeStop > 0, grabbed: !!p.grabbed, invulLong: p.invul > 3 });
  A.setup = (cls, job) => {
    game.job = job; Object.assign((save.data.flags ??= {}), { awaken: true, awaken2: true, awaken3: true });
    try { onJobChange(p, job); } catch (e) { /* 部分转职没有这个钩子 */ }
    const all = classSkills(cls, job);
    for (const id of all) { const S = SKILLS[id]; if (S) game.skillLv[id] = S.maxLv || (S.passive ? 1 : 10); }
    if (typeof recalcStats === 'function') recalcStats(p);
    A.step(20);
    A.keys0 = new Set(Object.keys(p));
    A.base0 = Object.fromEntries(Object.keys(p).filter(k => p[k] === null || p[k] === undefined || typeof p[k] !== 'object' && typeof p[k] !== 'function').map(k => [k, p[k]]));
    const awk = all.filter(id => SKILLS[id] && SKILLS[id].awaken && SKILLS[id].act && SKILLS[id].job === job).sort((a, b) => SKILLS[a].lvReq - SKILLS[b].lvReq);
    const skills = all.filter(id => { const S = SKILLS[id]; return S && S.act && !S.passive && !S.awaken && !S.instant && !S.airOnly && !S.whenHit; });
    return { awk, skills };
  };
  // 等到人物空闲（最多 sec 秒）
  A.settle = sec => { for (let i = 0; i < sec * 60; i++) { A.step(1); if (p.st !== 'act' && p.z <= 0.5 && p.st !== 'jump' && !(game.timeStop > 0)) { A.step(30); if (p.st !== 'act') return true; } } return false; };
  // 放 first（id 或 'attack'），到 frac 时按觉醒 awk
  A.start = first => {
    if (first === 'attack') A.tap('attack');
    else { game.skillBar[0] = first; const S = SKILLS[first]; if (S.req && S.req(p) !== true) return false; A.tap('s0'); }
    for (let i = 0; i < 12; i++) { A.step(1); if (p.st === 'act' && p.act && (first === 'attack' ? p.act.basic : p.act.skill === first)) { delete input.virt.s0; delete input.virt.attack; return true; } }
    for (const k in input.virt) delete input.virt[k];
    return false;
  };
  // 觉醒的前置（规格里的 pre，例：阿修罗一觉要先开无尽波动、机械师一觉要 G 系列在场）：先放出来等动作结束
  A.pre = ids => { for (const id of ids || []) { game.skillBar[3] = id; A.tap('s3'); A.step(1); delete input.virt.s3; for (let i = 0; i < 240 && p.st === 'act'; i++) A.step(1); A.step(6); game.skillBar[3] = null; } p.cool = {}; p.mp = p.mpMax; p.x = 300; p.face = 1; };
  A.one = (first, awks, frac, pre) => {
    // 对照：同一个技能不取消、放完的样子（召唤 / 变身类技能本来就会留下状态）
    A.seed(0x5eed); A.reset();
    A.pre(pre);
    if (!A.start(first)) return { skip: 'notCast' };
    A.settle(30); const base = A.snap();
    A.seed(0x5eed); A.reset(); A.pre(pre);
    if (!A.start(first)) return { skip: 'notCast' };
    const dur = p.act.dur || 0.5, wait = Math.max(4, Math.min(40, Math.round(dur * 60 * frac)));
    for (let i = 0; i < wait; i++) { A.step(1); if (p.st !== 'act') break; }
    const prev = p.act, prevSkill = prev && (prev.skill || (prev.basic && 'attack'));
    if (!prev) return { skip: 'ended' };
    const air = p.z > 2 || p.st === 'jump';
    const awk = awks.find(id => (!SKILLS[id].req || SKILLS[id].req(p) === true) && !(SKILLS[id].recast && SKILLS[id].recast.ok(p)));   // 召唤在场时再按 = 下命令，不算
    if (!awk) return { skip: 'awkReq' };
    const allow = canCancelInto(p, awk);
    p.cool = {}; p.mp = p.mpMax;
    game.skillBar[1] = awk; A.tap('s1');
    let ok = false;
    for (let i = 0; i < 15; i++) { A.step(1); if (p.act && p.act.skill === awk) { ok = true; break; } }
    delete input.virt.s1;
    const dbg = ok ? null : { act: p.act && p.act.name, skill: p.act && p.act.skill, st: p.st, cd: p.cool[awk], buf: input.buf.map(b => b.k || b.key || b).slice(-4) };
    // 觉醒中再按一次别的觉醒（或同一个）：不能打断
    let awkLocked = null;
    if (ok) { const a0 = p.act; A.step(10); if (p.act === a0) { const other = game.skillBar[1]; game.skillBar[2] = other; p.cool = {}; A.tap('s2'); A.step(2); delete input.virt.s2; awkLocked = p.act === a0 || !p.act || p.act.skill === awk; } }
    const settled = A.settle(30);
    const after = A.snap();
    const leak = [...new Set([...Object.keys(base), ...Object.keys(after)])].filter(k => k !== 'st' && k !== 'z' && !!base[k] !== !!after[k] && !(typeof base[k] === 'number' && base[k] === after[k])).map(k => `${k}:${base[k]}→${after[k]}`);
    return { awk, prevSkill, air, allow, ok, awkLocked, settled, st: after.st, z: after.z, leak, dbg };
  };
}

const { browser, page, logs } = await launch({ width: 640, height: 360 });
let fails = 0; const t0 = Date.now();
for (const item of list) {
  const [cls, job] = item.split(':'), spec = JSON.parse(fs.readFileSync(`docs/skills/${cls}.json`, 'utf8')).skills || {};
  await page.goto(`${URL_BASE}?test&mute&cls=${cls}&mobs=0`); await page.waitForFunction(() => window.__READY, null, { timeout: 30000 });
  await page.evaluate(pageInit);
  const { awk, skills } = await page.evaluate(({ cls, job }) => AWK.setup(cls, job), { cls, job });
  const rows = [], bad = [];
  const firsts = ['attack', ...skills];
  for (const [i, first] of firsts.entries()) {
    const order = awk.map((_, k) => awk[(i + k) % awk.length]);
    const specOf = id => spec[id + '@' + job] || spec[id] || {};
    const pre = [...new Set([...(specOf(first).pre || []), ...(specOf(order[0]).pre || [])])];
    const r = await page.evaluate(({ first, order, pre }) => { try { return AWK.one(first, order, 0.3, pre); } catch (e) { return { err: String(e && e.stack || e).slice(0, 300) }; } }, { first, order, pre });
    const a = r.awk || order[0];
    rows.push({ first, ...r });
    if (r.skip) continue;
    const why = [];
    if (r.err) why.push('报错 ' + r.err);
    if (!r.air && r.allow && !r.ok) why.push('允许取消但没切进觉醒 ' + JSON.stringify(r.dbg));
    if (!r.air && !r.allow) why.push('被挡住（noAwk？）');
    if (r.ok && r.awkLocked === false) why.push('觉醒被另一个觉醒打断');
    if (!r.settled) why.push(`没回到空闲（${r.st}, z ${r.z}）`);
    if (r.leak && r.leak.length) why.push('残留 ' + r.leak.join(' '));
    if (why.length) bad.push(`${first} → ${a}：${why.join('；')}`);
  }
  const n = rows.filter(r => !r.skip).length, cut = rows.filter(r => r.ok).length, blocked = rows.filter(r => !r.skip && !r.air && !r.allow).map(r => r.first);
  console.log(`${item}: 测 ${n} 个（跳过 ${rows.length - n}：${rows.filter(r => r.skip).map(r => r.first + '/' + r.skip).join(' ') || '无'}），切入觉醒 ${cut}（空中不切 ${rows.filter(r => r.air).map(r => r.first).join(' ') || '无'}），挡住 ${blocked.length ? blocked.join(' ') : 0}`);
  for (const b of bad) console.log('  ✗ ' + b);
  fails += bad.length;
}
const errs = logs.filter(l => l.type === 'pageerror');
for (const e of errs.slice(0, 5)) console.log('  ✗ pageerror', JSON.stringify(e).slice(0, 300));
console.log(`觉醒取消：${fails + errs.length ? '✗ ' + (fails + errs.length) + ' 项问题' : '全部通过'}（${((Date.now() - t0) / 1000).toFixed(0)}s）`);
await browser.close();
process.exit(fails + errs.length ? 1 : 0);
