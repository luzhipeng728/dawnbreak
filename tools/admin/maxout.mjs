import fs from 'fs';
import { launch, URL_BASE } from '../../test/lib.mjs';
// 用法（一般由 tools/admin/maxout.sh 调用）：node tools/admin/maxout.mjs <工作目录> [职业=转职,...] [额外点券]
//   <工作目录>/cloud.json（{ data }）→ <工作目录>/maxed.json；没转职的角色按第 2 个参数转职（例 sword=soulbender,gun=ranger,mage=elemental）
const S = process.argv[2], cloud = JSON.parse(fs.readFileSync(S + '/cloud.json', 'utf8')).data;
const JOBS = Object.fromEntries((process.argv[3] || '').split(',').filter(Boolean).map(x => x.split('='))), BONUS = +(process.argv[4] || 0);
const { browser, page, logs } = await launch({ width: 1280, height: 720 });
await page.goto(`${URL_BASE}?town&mute&cls=gun`); await page.waitForFunction(() => window.__READY && game.player && game.scene === 'town', null, { timeout: 60000 });
const out = await page.evaluate(async ({ cloud, JOBS, BONUS }) => {
  window.toastMsg = () => {};
  const root = { v: cloud.v, cur: cloud.cur, chars: cloud.chars, acct: cloud.acct };
  localStorage.setItem(save.key, JSON.stringify(root)); save.loadAll();
  const report = [];
  for (let i = 0; i < save.chars.length; i++) {
    save.select(i); const cls = save.data.cls;
    for (const k of ['spr:' + cls]) await loadBundles([k]);
    game.player = makePlayer(cls); save.apply(); const p = game.player;
    // 等级 / 转职 / 觉醒
    game.lvl = MAX_LVL; game.exp = 0;
    const fl = save.data.flags ??= {}; fl.awaken = fl.awaken2 = fl.awaken3 = true;
    // 任务：本职业能做的非每日任务全部完成
    const d = qdata(); let qn = 0;
    for (const id in QUESTS) { const q = QUESTS[id]; if (q.type === 'daily' || (q.cls && q.cls !== cls)) continue; if (!d.questDone[id]) { d.questDone[id] = Date.now(); qn++; } delete d.quests[id]; }
    d.questTrack = []; questDirty && questDirty();
    const fresh = !game.job;   // 这次才转职的角色：技能栏整个按转职技能重排
    if (!game.job && JOBS[cls] && !doJobChange(JOBS[cls])) throw new Error('job change failed for ' + cls);   // 转职试炼做完之后才能转职
    // 技能：全部学满（走技能窗口同一套规则）
    game.sp = 1e6;
    for (let pass = 0; pass < 12; pass++) { let n = 0; for (const id in SKILLS) while (!skillUpBlock(id)) { skillUp(id); n++; if (n > 5000) break; } if (!n) break; }
    game.sp = 0;
    const learned = Object.keys(game.skillLv).filter(id => game.skillLv[id] > 0 && SKILLS[id]);
    const actives = learned.filter(id => !SKILLS[id].passive);
    // 技能栏：一 / 二 / 三觉放最后三格（T / Y / 第 14 格）；其余保留玩家原来的摆放，空位按转职技能优先、等级高优先补上
    const aw = actives.filter(id => SKILLS[id].awaken).sort((a, b) => (SKILLS[a].lvReq || 0) - (SKILLS[b].lvReq || 0));
    const N = game.skillBar.length, bar = game.skillBar.map(id => !fresh && id && actives.includes(id) && !SKILLS[id].awaken ? id : null);
    const keep = bar.slice(0, N - aw.length).filter(Boolean);
    const rank = id => (SKILLS[id].job ? 1000 : 0) + (SKILLS[id].lvReq || 0);
    const rest = actives.filter(id => !SKILLS[id].awaken && !keep.includes(id)).sort((a, b) => rank(b) - rank(a));
    const front = bar.slice(0, N - aw.length); for (let k = 0; k < front.length && rest.length; k++) if (!front[k]) front[k] = rest.shift();
    game.skillBar = front.concat(aw);
    // 装备：按装备对比同一套指标挑最强（单件 + 整套），全身 +12
    const type = mainDmgType(p), old = { ...inv.equip };
    const GEAR = SLOTS.filter(s => !s.startsWith('av_'));
    const mk = k => { const it = makeItem(k, 1); if (!it) return null; if (!ITEMS[k].noEnhance && it.slot !== 'title') it.enh = 12; normalizeItem(it); if (it.durMax) it.dur = it.durMax; return it; };
    const cand = {}; for (const s of GEAR) cand[s] = [];
    for (const k in ITEMS) { const D = ITEMS[k]; if (D.kind !== 'equip' || !GEAR.includes(D.slot) || (D.lvl || 1) > MAX_LVL) continue;
      if (D.set && SETS[D.set] && SETS[D.set].job && SETS[D.set].job !== game.job) continue;
      const it = mk(k); if (!it || (it.slot === 'weapon' && it.cls && it.cls !== cls) || !inv.canWear(it, true)) continue; cand[it.slot].push(it); }
    const score = () => { const m = gearMetrics(p, type); return m.off * Math.pow(m.ehp, 0.2); };
    for (const s of GEAR) delete inv.equip[s];
    let best = score();
    for (let pass = 0; pass < 4; pass++) {
      let changed = false;
      for (const s of GEAR) for (const it of cand[s]) { const prev = inv.equip[s]; inv.equip[s] = it; const v = score(); if (v > best * 1.0001) { best = v; changed = true; } else { if (prev) inv.equip[s] = prev; else delete inv.equip[s]; } }
      for (const sid in SETS) { const pcs = SETS[sid].pieces.map(k => GEAR.map(s => cand[s].find(x => x.key === k)).find(Boolean)).filter(Boolean); if (pcs.length < 2) continue;
        const prev = {}; for (const it of pcs) prev[it.slot] = inv.equip[it.slot]; for (const it of pcs) inv.equip[it.slot] = it;
        const v = score(); if (v > best * 1.0001) { best = v; changed = true; } else for (const s in prev) { if (prev[s]) inv.equip[s] = prev[s]; else delete inv.equip[s]; } }
      if (!changed) break;
    }
    for (const s of GEAR) { const o = old[s]; if (o && inv.equip[s] !== o) inv.items.push(o); }   // 换下来的放回背包
    recalcStats(p); p.hp = p.hpMax; p.mp = p.mpMax;
    save.data.fatigue = FATIGUE_MAX;
    save.write();
    report.push({ name: save.data.name, cls, job: game.job, lvl: game.lvl, quests: qn, skills: learned.length, bar: game.skillBar.filter(Boolean).length,
      gear: GEAR.map(s => inv.equip[s] ? `${s}:${inv.equip[s].name}${inv.equip[s].enh ? '+' + inv.equip[s].enh : ''}(${inv.equip[s].rar})` : `${s}:-`), atk: Math.round(type === 'mag' ? p.matk : type === 'indep' ? p.indep : p.baseStats.atk), hp: p.hpMax, flags: save.data.flags });
  }
  if (BONUS) { save.acct.cera = (save.acct.cera || 0) + BONUS; save.persist(); }   // 额外点券（账号共享）
  return { report, saved: JSON.parse(localStorage.getItem(save.key)) };
}, { cloud, JOBS, BONUS });
fs.writeFileSync(S + '/maxed.json', JSON.stringify(out.saved));
for (const r of out.report) console.log(JSON.stringify(r, null, 0));
console.log('errors:', logs.filter(l => l.type === 'pageerror').map(l => l.text.slice(0, 200)));
await browser.close();
