// 满级 30 → 60（2026-09-28）：经验曲线 / 属性 / 技能上限 / 31~60 装备与商店 / 希洛克 Lv60 / 界面文字 / 决斗固定等级 / 怪物等级公式
// 用法：node test/levelcap.mjs            快速检查（约 10 秒）
//       node test/levelcap.mjs bot [地下城=law_gate] [职业=sword] [品级=2] [强化=12]
//         机器人对照：同一个希洛克地下城先临时降回 Lv30（同样的难度旋钮）让 Lv30 稀有装打，再用 Lv60 稀有装打 Lv60 原版，比较用时 / 被击 / 死亡
import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';
import path from 'path';
let fail = 0; const ok = (c, m, x = '') => { console.log(c ? '  ✓' : '  ✗', m, typeof x === 'string' ? x : JSON.stringify(x)); if (!c) fail++; };
const mode = process.argv[2] || 'fast';
const { browser, page, logs } = await launch({ width: 1280, height: 720 });
const open = async cls => { await page.goto(`${URL_BASE}?town&mute&cls=${cls}&fresh`); await page.waitForFunction(() => window.__READY && game.player && game.scene === 'town', null, { timeout: 30000 }); };

if (mode === 'fast') {
  await open('sword');
  // 1. 经验：30 → 60 能升上去，满级后不再涨；曲线单调、在 Lv30 处连续
  const e = await page.evaluate(() => {
    window.toastMsg = () => {};
    const need = []; for (let l = 1; l < 60; l++) need.push(expNeed(l));
    let lo = 0, hi = 0; for (let l = 1; l < 30; l++) lo += expNeed(l); for (let l = 30; l < 60; l++) hi += expNeed(l);
    game.lvl = 30; game.exp = 0; const sp0 = game.sp; gainExp(hi);
    const r = { cap: MAX_LVL, lvl: game.lvl, sp: game.sp - sp0, mono: need.every((v, i) => !i || v > need[i - 1]), jump30: +(expNeed(30) / expNeed(29)).toFixed(3), jump31: +(expNeed(31) / expNeed(30)).toFixed(3), ratio: +(hi / lo).toFixed(2) };
    const x0 = game.exp; gainExp(1e7); r.stay = game.lvl === 60 && game.exp === x0;
    return r;
  });
  let spWant = 0; for (let l = 31; l <= 60; l++) spWant += 28 + l;
  ok(e.cap === 60 && e.lvl === 60, 'Lv30 靠经验一路升到 Lv60', e);
  ok(e.sp === spWant, `31~60 每级照常发 SP（共 ${spWant}）`, e.sp);
  ok(e.stay, '满级后经验不再增加、不再升级');
  ok(e.mono && e.jump30 < 1.1 && e.jump31 < 1.1, '经验曲线单调，Lv30 前后平滑', e);
  // 2. 属性：同一身装备，Lv30 → 60 属性一路涨
  const st = await page.evaluate(() => { const p = game.player, o = []; for (const L of [30, 40, 50, 60]) { game.lvl = L; recalcStats(p); o.push([Math.round(p.baseStats.atk), p.hpMax, Math.round(p.def), p.str]); } return o; });
  ok(st.every((r, i) => !i || r.every((v, k) => v > st[i - 1][k])), '物攻 / HP / 防御 / 力量随等级继续成长（Lv30 / 40 / 50 / 60）', st);
  // 3. 技能等级上限：普通主动技能 Lv30 后每 3 级 +1；被动 / BUFF / 觉醒不变；决斗 aiKit 仍按 S.maxLv
  const sk = await page.evaluate(() => {
    const act = Object.values(SKILLS).find(S => S.cls === 'sword' && !S.job && skillGrows(S) && S.maxLv === 10 && S.lvReq <= 10);
    const pas = Object.values(SKILLS).find(S => S.passive && S.maxLv >= 5), aw = Object.values(SKILLS).find(S => S.awaken);
    game.lvl = 30; game.sp = 1e6; game.skillLv[act.id] = act.maxLv; const at30 = skillUpBlock(act.id);
    game.lvl = 60; let n = 0; while (!skillUpBlock(act.id) && n++ < 50) skillUp(act.id);
    const kit = aiKit('sword', Object.keys(CLASSES.sword.jobs)[0], DUEL_CFG.lv);
    return { id: act.id, max: skillMaxLv(act), at30, lv60: game.skillLv[act.id], req11: skillLvReq(act, 11), pas: skillMaxLv(pas) === pas.maxLv, aw: skillMaxLv(aw) === aw.maxLv,
      duelOk: Object.entries(kit.lv).every(([id, l]) => l <= (SKILLS[id].maxLv || 1)) };
  });
  ok(sk.max === 20 && sk.lv60 === 20 && sk.at30 === '需要等级 33' && sk.req11 === 33, '主动技能上限 10 → Lv60 时 20（第 11 级要 Lv33，之后每 3 级 +1）', sk);
  ok(sk.pas && sk.aw, '被动 / 觉醒技能上限不变');
  ok(sk.duelOk, '决斗技能等级仍按原上限（不吃 Lv60 的额外等级）');
  // 4. 装备：31~60 每 5 级一段都有各品级的武器 / 防具 / 首饰 / 特殊装备；随机掉落、商店、强化费用都能用到
  const g = await page.evaluate(() => {
    const miss = [];
    for (const L of [35, 40, 45, 50, 55, 60]) for (const r of [0, 1, 2, 3, 4]) {
      if (!RAR_TIERS[r].includes(L)) continue;
      for (const s of ['weapon', 'top', 'neck', 'ring']) if (!GEAR.some(D => D.lvl === L && D.rar === r && D.slot === s && !D.set)) miss.push(`${s}@${L}r${r}`);
    }
    for (const L of [35, 40, 45, 50, 55, 60]) for (const s of ['support', 'stone']) if (!GEAR.some(D => D.lvl === L && D.slot === s)) miss.push(`${s}@${L}`);
    const names = GEAR.filter(D => D.lvl > 30 && D.rar < 5).map(D => D.name), bad = names.filter(n => !n || /undefined|NaN/.test(n));
    const rolls = []; for (let i = 0; i < 60; i++) { const it = rollEquip({ lvl: 47, rar: i % 5 }); if (it) rolls.push(it.lvl); }
    game.lvl = 45; const shop = SHOPS.linus.tabs[0].goods(45, 'sword').map(k => ITEMS[k].lvl), arm = SHOPS.linus.tabs[1].goods(45).map(k => ITEMS[k].lvl);
    const w30 = makeItem('katana_30_2'), w60 = makeItem('katana_60_2');
    return { miss, bad: bad.length, rolls: [Math.min(...rolls), Math.max(...rolls), rolls.length], shopHi: Math.max(...shop), armHi: Math.max(...arm),
      price: [w30.price, w60.price], enh: [enhCost(w30).gold, enhCost(w60).gold], atk: [w30.st.atk, w60.st.atk] };
  });
  ok(!g.miss.length && !g.bad, '31~60 各等级段 / 品级的通用装备齐全、名字正常', g.miss.slice(0, 8));
  ok(g.rolls[0] >= 40 && g.rolls[1] <= 48 && g.rolls[2] === 60, `Lv47 随机掉落的装备等级 ${g.rolls[0]}~${g.rolls[1]}`);
  ok(g.shopHi >= 45 && g.armHi >= 45, 'Lv45 时林纳斯的武器 / 防具货架有 Lv45+ 的装备', g);
  ok(g.price[1] > g.price[0] && g.enh[1] > g.enh[0] && g.atk[1] > g.atk[0], 'Lv60 装备比 Lv30 更强、更贵、强化更贵', g);
  // 5. 希洛克在 Lv60；入口暂时还在天帷巨兽（Lv30 就能过去，等 31~59 区域做好再挪）
  const si = await page.evaluate(() => {
    const R = REGIONS.siroco, sp = R.spec, E = sp.entry, ex = (SCENES[E.scene] || { exits: [] }).exits.find(x => x.to === E.to);
    const eps = GEAR.filter(D => /^ep_si_/.test(D.key));
    return { lvl: sp.lvl, dg: R.dungeons.every(id => DUNGEONS[id].lvl[0] >= 60), boss: R.bosses.every(id => MON[id].lvl >= 60), mons: R.monsters.every(id => MON[id].lvl >= 60),
      eps: eps.length && eps.every(D => D.lvl === 60), abyss: (R.abyss || []).every(id => DUNGEONS[id].lvl[0] >= 60), entry: !!ex && ex.minLv <= 60, quests: R.quests.every(q => QUESTS[q].lvl >= 60) };
  });
  ok(si.lvl === 60 && si.dg && si.boss && si.mons && si.eps && si.abyss && si.quests, '希洛克：地下城 / 怪物 / 领主 / 史诗 / 深渊 / 主线都是 Lv60', si);
  ok(si.entry, '希洛克的入口还能走（等级限制 ≤ 60）');
  // 6. 成就：老的 Lv30 成就还在，新增 Lv60（带称号）
  const ach = await page.evaluate(() => ({ l30: !!ACHIEVEMENTS.lvl30, l60: ACHIEVEMENTS.lvl60 && ACHIEVEMENTS.lvl60.n === 60 && ACHIEVEMENTS.lvl60.reward.title, title: ITEMS.title_ach_lvl60 && ITEMS.title_ach_lvl60.lvl }));
  ok(ach.l30 && ach.l60 && ach.title === 60, '等级成就：Lv30 保留，新增 Lv40 / 50 / 60（Lv60 送称号）', ach);
  // 7. 老存档：Lv30 角色进城提示新上限一次，经验保留
  const t = await page.evaluate(() => { const got = []; window.toastMsg = m => got.push(m); game.lvl = 30; game.exp = 12345; save.data.capNote = undefined; save.data.seenHelp = true; afterEnterWorld(); afterEnterWorld(); return { got: got.filter(m => /等级上限/.test(m)).length, exp: game.exp }; });
  ok(t.got === 1 && t.exp === 12345, '老的 Lv30 角色：进城提示“等级上限提升到 Lv.60”（只提示一次），经验不动', t);
  // 8. 决斗：固定 Lv30
  const du = await page.evaluate(() => { game.lvl = 60; const p = makePlayer('sword'); p.kit = { job: Object.keys(CLASSES.sword.jobs)[0] }; duelStats(p); return { cfg: DUEL_CFG.lv, lvl: p.lvl, hp: p.hpMax }; });
  ok(du.cfg === 30 && du.lvl === 30 && du.hp === 21000, '决斗等级固定 Lv30（角色 Lv60 进决斗也按 30 算，属性是天平值）', du);
  // 9. 怪物等级公式：Lv30 以内不变；Lv60 稀有装打 Lv60 区域怪的击杀 / 受伤和 Lv30 相近（算上技能等级成长）
  const mon = await page.evaluate(() => {
    const old = lv => ({ hp: 1 + (lv - 1) * 0.15, atk: 1 + (lv - 1) * 0.1, def: 1 + (lv - 1) * 0.08 });
    const same = [1, 15, 30].every(lv => { const a = monLvScale(lv), b = old(lv); return Math.abs(a.hp - b.hp) < 1e-9 && Math.abs(a.atk - b.atk) < 1e-9 && Math.abs(a.def - b.def) < 1e-9; });
    const act = Object.values(SKILLS).filter(S => S.pow && skillGrows(S));
    const F = lv => { let s = 0, n = 0; for (const S of act) { try { const a = S.pow(lv), b = S.pow(1); if (a > 0 && b > 0 && isFinite(a / b)) { s += a / b; n++; } } catch (e) { /* 跳过 */ } } return s / n; };
    const skF = L => { let sp = 0; for (let l = 2; l <= L; l++) sp += 28 + l; const lv = Math.min(10 + Math.max(0, Math.floor((L - 30) / 3)), sp / 240), f = Math.floor(lv); return F(f) + (F(f + 1) - F(f)) * (lv - f); };
    const out = {};
    for (const cls of ['sword', 'gun', 'mage']) {
      const p = makePlayer(cls); game.player = p; const row = {};
      for (const L of [30, 60]) {
        game.lvl = L; const m = masteryOf(cls, null), w = CLASS_START_WEAPON[cls];
        for (const s of Object.keys(SLOT_WEIGHT)) { const k = s === 'weapon' ? `${w}_${L}_2` : ARMOR_SLOTS.includes(s) ? `${m}_${s}_${L}_2` : `${s}_${L}_2`; inv.equip[s] = makeItem(k, 1, { grade: 2 }); }
        recalcStats(p); const atk = Math.max(p.baseStats.atk, p.matk), S = regionStats('normal', L, 1), K = monLvScale(L);
        const hp = S.hp * K.hp, def = S.def * K.def, matk = S.atk * K.atk * MON_ATK_MUL;
        row[L] = { kill: hp / (atk * (1 - def / (def + 1200))) / skF(L), die: p.hpMax / (matk * (1 - p.def / (p.def + 1200))) };
      }
      out[cls] = { kill: +(row[60].kill / row[30].kill).toFixed(2), die: +(row[60].die / row[30].die).toFixed(2) };
    }
    return { same, out };
  });
  ok(mon.same, '怪物等级倍率在 Lv30 以内和原来一样');
  ok(Object.values(mon.out).every(r => r.kill > 0.7 && r.kill < 1.3 && r.die > 0.75 && r.die < 1.35), 'Lv60 对 Lv60 怪：击杀用时 / 扛几下，和 Lv30 对 Lv30 相差不超过 30%（60÷30 的比值）', mon.out);
  // 10. 界面文字里没有“满级 30”
  const hits = [];
  const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else if (f.endsWith('.js')) fs.readFileSync(f, 'utf8').split('\n').forEach((l, i) => { if (/满级\s*(Lv\.?\s*)?30(?!\s*(→|提到|到))|30\s*级满级|满级\s*\(\s*30\s*\)/.test(l)) hits.push(`${f}:${i + 1}`); }); } };
  walk('src');
  ok(!hits.length, '源码 / 界面文字里没有“满级 30”的残留', hits.slice(0, 5));
}

if (mode === 'bot') {
  const [did = 'law_gate', cls = 'sword', rar = '2', enh = '12'] = process.argv.slice(3), speed = +(process.env.SPEED || 3);
  const rows = [];
  for (const L of (process.env.LVS || "30,60").split(",").map(Number)) {
    await open(cls); await page.evaluate(s => { game.speedMul = s; }, speed);
    const setup = await page.evaluate(({ did, L, rar, enh, noext }) => {
      const R = REGIONS.siroco, sp = R.spec, d = L - sp.lvl;
      if (d) {   // 临时把整个区域平移到 Lv L（同样的 power / bossPower / atkPower），和 regionMonster 的算法一样
        const upd = (id, M, boss) => { const lvl = (M.lvl || sp.lvl) + d, S = regionStats(M.tier || (boss ? 'boss' : 'normal'), lvl, (sp.power || 1) * (boss ? sp.bossPower || 1 : 1) * (M.power || 1), sp.atkPower && sp.atkPower * (M.atkPower || 1));
          Object.assign(MON[id], { lvl, hp: S.hp, atk: S.atk, def: S.def, exp: S.exp }); if (boss) MON[id].bars = S.bars; };
        for (const [id, M] of Object.entries(sp.monsters)) upd(id, M, false);
        for (const [id, M] of Object.entries(sp.bosses)) upd(id, M, true);
        for (const id of R.dungeons) { const D = DUNGEONS[id]; D.lvl = D.lvl.map(x => x + d); D.boss.lvl += d; }
      }
      testLoadout(L); if (noext) for (const id in game.skillLv) game.skillLv[id] = Math.min(game.skillLv[id], SKILLS[id].maxLv || 1); const p = game.player, m = masteryOf(p.cls, game.job), w = CLASS_START_WEAPON[p.cls];
      for (const s of Object.keys(SLOT_WEIGHT)) { const k = s === 'weapon' ? `${w}_${L}_${rar}` : ARMOR_SLOTS.includes(s) ? `${m}_${s}_${L}_${rar}` : `${s}_${L}_${rar}`; const it = makeItem(k, 1, { grade: 2 }); if (it) { it.enh = +enh; inv.equip[s] = it; } }
      recalcStats(p); p.hp = p.hpMax; p.mp = p.mpMax; save.data.fatigue = 999; bot.on = true; window.__botDone = null;
      enterDungeon(did, 0);
      return { atk: Math.round(Math.max(p.baseStats.atk, p.matk)), hp: p.hpMax, dg: DUNGEONS[did].lvl.join('-'), bossLv: DUNGEONS[did].boss.lvl };
    }, { did, L, rar, enh, noext: !!process.env.NOEXT });
    const limit = +(process.env.LIMIT || 900);
    const done = await page.waitForFunction(() => window.__botDone, null, { timeout: limit * 1000 / speed, polling: 2000 }).then(h => h.jsonValue()).catch(() => null);
    const last = done ? null : await page.evaluate(() => { const D = game.dungeon; return D ? { room: D.layout.rooms.indexOf(D.room), bossHp: D.boss ? Math.round(D.boss.hp / D.boss.hpMax * 100) : null, t: Math.round(D.t), hurt: D.hurt, deaths: bot.deaths || 0 } : null; });
    rows.push({ L, cls, dungeon: did, ...setup, ...(done ? { time: done.time, hurt: done.hurt, deaths: done.deaths, rank: done.rank } : { rank: 'TIMEOUT', last: JSON.stringify(last) }) });
  }
  console.table(rows);
  const [a, b] = rows.length > 1 ? rows : [rows[0], rows[0]];
  ok(a.time && b.time, '两次都通关了', rows.map(r => r.rank));
  if (a.time && b.time) ok(b.time / a.time < 1.5 && b.time / a.time > 0.6 && b.hurt <= a.hurt * 1.6 + 10, `Lv60 / Lv30 用时比 ${(b.time / a.time).toFixed(2)}，被击 ${a.hurt} → ${b.hurt}`);
}

const errs = logs.filter(l => l.type === 'pageerror');
ok(!errs.length, '没有页面错误', errs.slice(0, 3).map(e => e.text.slice(0, 200)));
await browser.close();
console.log(fail ? `✗ ${fail} 项失败` : '全部通过');
process.exit(fail ? 1 : 0);
