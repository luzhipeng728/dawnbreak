// 通用技能后摇取消（game/skill_cancel.js，docs/SKILLS_OFFICIAL_common.md §5.3）：逐帧推进、不渲染
//   rules  规则单测：命中确认 + 取消点（最后判定结束 + 0.05 / 最后事件 + 0.05 / 60%，不超过 80%）、cancelAt / noCancel / noCancelInto / cancelNoHit、
//          BUFF / 同一招 / 抓取 / 长动作不行、links 白名单和职业柔化照旧、?nocancel 关掉、AI 的 canSkillCancel 不变、决斗冷却 ×1.2、投射物命中算这一招
//   jobs   每个职业（默认每职业一个转职，参数 all = 全部转职）：每个攻击技能对木桩放出 → 命中后在取消点按另一个攻击技能，真的切进去；取消点之前切不进去
// 用法：node test/skill_cancel.mjs [rules,jobs] [all | sword:blade,gun:ranger]
import { launch, URL_BASE, openLists } from './lib.mjs';
const parts = (process.argv[2] || 'rules,jobs').split(',');
const { browser, page, logs } = await launch({ width: 640, height: 360 });
let fails = 0;
const ok = (c, msg, x) => { if (c) console.log('✓', msg); else { fails++; console.log('✗', msg, x !== undefined ? JSON.stringify(x).slice(0, 900) : ''); } };
const errs = []; page.on('pageerror', e => errs.push(String(e && e.message || e)));

function pageInit() {
  game.paused = true; window.toastMsg = () => {};
  const p = game.player, T = window.SC = {};
  T.step = n => { for (let i = 0; i < n; i++) step(1 / 60); };
  T.tap = k => { input.virt[k] = 2; };
  T.reset = () => {
    for (const k in input.virt) delete input.virt[k];
    input.buf.length = 0; input.dirHist.length = 0; input.down.clear();
    if (typeof clearAllSummons === 'function') clearAllSummons('audit');
    for (const e of ents) if (e !== p) e.remove = true;
    if (p.act) p.interrupt();
    game.timeStop = 0; game.cutin = null; game.timers.length = 0; game.pvp = false;
    T.step(1); projs.length = 0;
    Object.assign(p, { x: 300, y: 100, z: 0, vx: 0, vy: 0, vz: 0, face: 1, act: null, invul: 0, superArmor: 0, hitstop: 0, dead: false, cool: {}, buffs: {}, charges: {}, bsCd: 0, stun: 0, grabbed: null, chasers: [] });
    p.mpMax = Math.max(p.mpMax, 99999); p.hp = p.hpMax; p.mp = p.mpMax; p.setState('idle'); resetCmb(p);
    for (let i = 0; i < game.skillBar.length; i++) game.skillBar[i] = null;
    T.step(2);
    const m = spawnMonster('goblin', 350, 100); m.control = null; m.act = null; m.hp = m.hpMax = 1e9; m.invul = 0; m.evade = 0; m.face = -1; m.weight = 9; m.setState('idle'); m.noGrab = true;
    return m;
  };
  T.setup = (cls, job) => {
    game.job = job;
    try { onJobChange(p, job); } catch (e) { /* 部分转职没有这个钩子 */ }
    const all = classSkills(cls, job);
    for (const id of all) { const S = SKILLS[id]; if (S) game.skillLv[id] = S.maxLv || (S.passive ? 1 : 10); }
    if (typeof recalcStats === 'function') recalcStats(p);
    T.step(20);
    const atk = all.filter(id => { const S = SKILLS[id]; return S && S.act && !S.passive && !S.awaken && !S.instant && !S.airOnly && !S.whenHit && !S.recast && !S.buff && !(S.ai && ['buff', 'stance', 'mode'].includes(S.ai.kind)); });
    const buff = all.find(id => SKILLS[id] && SKILLS[id].buff && SKILLS[id].act);
    return { atk, buff };
  };
}

if (parts.includes('rules')) {
  await page.goto(`${URL_BASE}?test&mute&cls=sword&mobs=0`); await page.waitForFunction(() => window.__READY, null, { timeout: 60000 });
  await page.evaluate(pageInit);
  const r = await page.evaluate(() => {
    const p = game.player, out = {}; const { atk, buff } = SC.setup('sword', 'blade');
    const ids = atk.filter(id => !SKILLS[id].links && !SKILLS[id].cancelAt && !SKILLS[id].noCancel);
    const X = ids[0], Y = ids[1];
    const put = (def, t, hit) => { SC.reset(); p.doAct({ name: 'sc', clip: 'idle', ...def }, { skill: X, lv: 1 }); p.actT = t; p.hitsDone.clear(); if (hit) p.hitsDone.set(1, 0.1); return canCancelInto(p, Y); };
    const H = { dur: 0.6, hits: [{ t0: 0.1, t1: 0.25 }] };
    out.melee = { at: skillCancelAt({ ...H, skill: X }, SKILLS[X]), before: put(H, 0.28, true), noHit: put(H, 0.31, false), after: put(H, 0.31, true) };
    out.ev = { at: +skillCancelAt({ dur: 1, events: [{ t: 0.4 }, { t: 9 }] }, SKILLS[X]).toFixed(3), none: +skillCancelAt({ dur: 1 }, SKILLS[X]).toFixed(3), cap: +skillCancelAt({ dur: 1, hits: [{ t0: 0, t1: 0.99 }] }, SKILLS[X]).toFixed(3) };
    out.blk = { long: skillCancelAt({ dur: 4, hits: [{ t0: 0, t1: 0.2 }] }, SKILLS[X]), grab: skillCancelAt({ dur: 0.6, hits: [{ t0: 0, t1: 0.2, grab: true }] }, SKILLS[X]), awk: skillCancelAt({ dur: 0.6 }, { awaken: true }) };
    out.fields = { noCancel: put({ ...H, noCancel: true }, 0.5, true), cancelAt: put({ ...H, cancelAt: 0.15 }, 0.16, true), cancelAtFalse: put({ ...H, cancelAt: false }, 0.5, true), noHitOk: put({ ...H, cancelNoHit: true }, 0.31, false) };
    put(H, 0.5, true); out.into = { buff: buff ? canCancelInto(p, buff) : 'none', same: canCancelInto(p, X), nci: (() => { SKILLS[Y].noCancelInto = true; const v = canCancelInto(p, Y); delete SKILLS[Y].noCancelInto; return v; })() };
    SKILL_CANCEL.on = false; out.off = put(H, 0.5, true); SKILL_CANCEL.on = true;
    put(H, 0.5, true); game.pvp = true; out.pvpOn = canCancelInto(p, Y); SKILL_CANCEL.pvp = false; out.pvpOff = canCancelInto(p, Y); SKILL_CANCEL.pvp = true; game.pvp = false; out.hurr = !!(SKILLS.pi_hurricane && SKILLS.pi_hurricane.pvpNoCancelInto);
    put(H, 0.5, true); out.ai = canSkillCancel(p);
    // 真放：命中后切进去，冷却正常；决斗里 ×1.2；links 白名单照旧（在通用规则之前）
    const realCancel = pvp => { const m = SC.reset(); game.pvp = pvp; p.x = m.x - 50; game.skillBar[0] = X; game.skillBar[1] = Y; SC.tap('s0'); SC.step(1); delete input.virt.s0;
      let at = null; for (let i = 0; i < 240 && p.act && p.act.skill === X; i++) { at = skillCancelAt(p.act, SKILLS[X]); if (at !== null && p.actT >= at && (p.hitsDone.size || p.act.hitAny)) break; SC.step(1); }
      const hit = !!(p.act && (p.hitsDone.size || p.act.hitAny)); const r0 = canCancelInto(p, Y); p.cool[Y] = 0; const ok = r0 && castSkill(p, Y, false, 's1');
      const S = SKILLS[Y], want = S.cd * (p.cdMul || 1) * (pvp && S.pvpCd ? S.pvpCd : 1) * (pvp ? SKILL_CANCEL.pvpCdMul : 1);
      const res = { X, Y, hit, ok: !!ok, now: p.act && p.act.skill, via: p.act && p.act.viaCancel, cd: +(p.cool[Y] || 0).toFixed(2), want: +want.toFixed(2) }; game.pvp = false; return res; };
    out.real = realCancel(false); out.pvp = realCancel(true);
    // 投射物：这一招放出的子弹打中才算这一招命中；上一招的子弹在新一招里打中不算
    SC.reset(); p.doAct({ name: 'sc', clip: 'idle', dur: 0.8 }, { skill: X, lv: 1 }); const m2 = ents.find(e => e !== p && !e.remove);
    spawnProj({ owner: p, x: m2.x, y: m2.y, z: 20, w: 30, d: 30, h: 60, life: 0.2, hit: { dmg: 0.1, stun: 0.1, sure: true } }); SC.step(2); const projOwn = !!p.act && !!p.act.hitAny;
    p.doAct({ name: 'sc2', clip: 'idle', dur: 0.8 }, { skill: Y, lv: 1 }); const old = { owner: p, x: m2.x, y: m2.y, z: 20, w: 30, d: 30, h: 60, life: 0.2, hit: { dmg: 0.1, stun: 0.1, sure: true } };
    p.doAct({ name: 'sc3', clip: 'idle', dur: 0.8 }, { skill: X, lv: 1 }); const pr = spawnProj(old); p.doAct({ name: 'sc4', clip: 'idle', dur: 0.8 }, { skill: Y, lv: 1 }); SC.step(2); const projOld = !!p.act && !!p.act.hitAny;
    out.proj = { own: projOwn, old: projOld, src: !!pr.srcAct };
    return out;
  });
  ok(r.melee.at > 0.29 && r.melee.at < 0.31 && !r.melee.before && !r.melee.noHit && r.melee.after, '近身技能：最后一个判定结束 + 0.05 秒以后、而且打中过才能取消', r.melee);
  ok(r.ev.at === 0.45 && r.ev.none === 0.6 && r.ev.cap === 0.8, '取消点默认值：最后事件 + 0.05、没有判定 / 事件取 60%、不超过动作时长 80%', r.ev);
  ok(r.blk.long === null && r.blk.grab === null && r.blk.awk === null, '3 秒以上的持续动作、抓取、觉醒不能通用取消', r.blk);
  ok(!r.fields.noCancel && r.fields.cancelAt && !r.fields.cancelAtFalse && r.fields.noHitOk, '技能字段：noCancel / cancelAt: false 不能取消，cancelAt 改取消点，cancelNoHit 不用命中', r.fields);
  ok(r.into.buff === false && r.into.same === false && r.into.nci === false, '取消进去的只能是别的攻击技能（BUFF / 同一招 / noCancelInto 不行）', r.into);
  ok(r.pvpOn === true && r.pvpOff === false && r.hurr, '决斗：默认开（SKILL_CANCEL.pvp），可以整个关掉；蓝拳极速飓风拳决斗里不能被取消进去（pvpNoCancelInto，同干涸之泉的官方限制）', { on: r.pvpOn, off: r.pvpOff, hurr: r.hurr });
  ok(r.off === false && r.ai === false, '?nocancel 关掉；AI 判断忙不忙的 canSkillCancel 不变（AI 打法 / 决斗平衡不受影响）', { off: r.off, ai: r.ai });
  ok(r.real.hit && r.real.ok && r.real.now === r.real.Y && r.real.via === r.real.X && Math.abs(r.real.cd - r.real.want) < 0.02, `真放：${r.real.X} 打中后在后摇里切 ${r.real.Y}，冷却不变（${r.real.cd}s）`, r.real);
  ok(r.pvp.hit && r.pvp.ok && Math.abs(r.pvp.cd - r.pvp.want) < 0.02, `决斗：通用取消放出来的技能冷却 ×${1.2}（${r.pvp.cd}s）`, r.pvp);
  ok(r.proj.own && !r.proj.old && r.proj.src, '投射物：这一招放出的打中算这一招命中，上一招的子弹打中不算', r.proj);
}

if (parts.includes('jobs')) {
  const arg = process.argv[3];
  const L = arg === 'all' ? (await openLists()).jobs : arg ? arg.split(',') : ['sword:blade', 'gun:ranger', 'mage:elemental', 'fighter:striker', 'priest:crusader'];
  for (const item of L) {
    const [cls, job] = item.split(':');
    await page.goto(`${URL_BASE}?test&mute&cls=${cls}&mobs=0`); await page.waitForFunction(() => window.__READY, null, { timeout: 60000 });
    await page.evaluate(pageInit);
    const r = await page.evaluate(({ cls, job }) => {
      const p = game.player; const { atk } = SC.setup(cls, job); const rows = [];
      // 取消进去用的技能：冷却清零、地面能放、没有前置条件的第一个攻击技能
      const into = X => atk.find(id => id !== X && !SKILLS[id].req && !SKILLS[id].noCancelInto && !SKILLS[id].air);
      for (const X of atk) {
        let Y = into(X); if (!Y) continue;
        const m = SC.reset(); p.x = m.x - 45; game.skillBar[0] = X; game.skillBar[1] = Y;
        if (SKILLS[X].req && SKILLS[X].req(p) !== true) { rows.push({ X, skip: 'req' }); continue; }
        SC.tap('s0'); let started = false; for (let i = 0; i < 12; i++) { SC.step(1); if (p.act && p.act.skill === X) { started = true; break; } } delete input.virt.s0;
        if (!started) { rows.push({ X, skip: 'notCast' }); continue; }
        const a = p.act; let at = skillCancelAt(a, SKILLS[X]);
        if (at === null) { rows.push({ X, skip: 'noCancel' }); continue; }
        let early = false, reached = false;
        for (let i = 0; i < 600 && p.act === a; i++) {
          at = skillCancelAt(a, SKILLS[X]); if (at === null) break;   // 动作中途换判定的每帧现算
          if (p.actT < at - 1e-6 && (p.hitsDone.size || a.hitAny) && skillCancelOk(p, Y)) early = true;
          if (p.actT >= at && (p.hitsDone.size || a.hitAny)) { reached = true; break; }
          SC.step(1);
        }
        if (at === null) { rows.push({ X, skip: 'noCancel' }); continue; }
        if (!reached) { rows.push({ X, skip: p.act === a ? 'noHit' : 'endedNoHit', at: +at.toFixed(2) }); continue; }
        // 人在空中（跳起来的招）：换一个能在空中放的；没有就跳过
        if (!airOk(p, SKILLS[Y])) { const Y2 = atk.find(id => id !== X && !SKILLS[id].req && !SKILLS[id].noCancelInto && airOk(p, SKILLS[id])); if (!Y2) { rows.push({ X, skip: 'air' }); continue; } Y = Y2; game.skillBar[1] = Y; }
        const dbg = { z: Math.round(p.z), st: p.st, can: canCancelInto(p, Y), gen: skillCancelOk(p, Y), air: airOk(p, SKILLS[Y]), usable: skillUsable(p, Y), hitstop: +p.hitstop.toFixed(2), keyLinks: !!a.keyLinks, onInput: !!a.onInput };
        p.cool[Y] = 0; p.mp = p.mpMax; SC.tap('s1'); let ok = false; for (let i = 0; i < 20; i++) { SC.step(1); if (p.act && p.act.skill === Y) { ok = true; break; } } delete input.virt.s1;
        rows.push({ X, Y, at: +at.toFixed(2), dur: +(a.dur || 0).toFixed(2), early, ok, ...(ok ? {} : { dbg, now: p.act && (p.act.skill || p.act.name), actT: +p.actT.toFixed(2) }) });
      }
      return rows;
    }, { cls, job });
    const tried = r.filter(x => !x.skip), good = tried.filter(x => x.ok && !x.early), skip = r.filter(x => x.skip);
    const bad = tried.filter(x => !x.ok || x.early);
    ok(tried.length >= 3 && bad.length === 0, `${item}：${good.length}/${tried.length} 个打中的攻击技能在后摇里切得进别的技能、取消点之前切不进（跳过 ${skip.length}：${[...new Set(skip.map(s => s.skip))].join('/')}）`, bad.length ? bad : skip.slice(0, 8));
  }
}
ok(errs.length === 0, '页面没有报错', errs.slice(0, 3));
await browser.close();
console.log(fails ? `${fails} 项失败` : '全部通过');
process.exit(fails ? 1 : 0);
