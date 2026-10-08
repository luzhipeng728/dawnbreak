// 把云端存档拉下来的 cloud.json 里的角色一键练满（等级 / 装备 / 技能 / 转职），写成 maxed.json；一般由 tools/admin/admin.sh 调用
import fs from 'fs';
import { launch, URL_BASE } from '../../test/lib.mjs';
// 用法（一般由 tools/admin/maxout.sh 调用）：node tools/admin/maxout.mjs <工作目录> [职业=转职,...] [额外点券]
//   <工作目录>/cloud.json（{ data }）→ <工作目录>/maxed.json；没转职的角色按第 2 个参数转职（例 sword=soulbender,gun=ranger,mage=elemental）
const S = process.argv[2], cloud = JSON.parse(fs.readFileSync(S + '/cloud.json', 'utf8')).data;
const JOBS = Object.fromEntries((process.argv[3] || '').split(',').filter(Boolean).map(x => x.split('='))), BONUS = +(process.argv[4] || 0);
// 第 5 个参数：新建角色（只处理新建的，已有角色不动），多个用逗号：职业:转职:等级:装备(max|normal):名字   例 sword:berserker:60:max:血狱狂战（等级省略 = 满级 60）,sword:berserker:20:normal:狂战练级
const NEW = (process.argv[5] || '').split(',').filter(Boolean).map(x => { const [cls, job, lv, gear, name] = x.split(':'); return { cls, job, lv: +lv || 60, gear: gear || 'max', name }; });
const { browser, page, logs } = await launch({ width: 1280, height: 720 });
await page.goto(`${URL_BASE}?town&mute&cls=gun`); await page.waitForFunction(() => window.__READY && game.player && game.scene === 'town', null, { timeout: 60000 });
const out = await page.evaluate(async ({ cloud, JOBS, BONUS, NEW }) => {
  window.toastMsg = () => {};
  const root = { v: cloud.v, cur: cloud.cur, chars: cloud.chars, acct: cloud.acct };
  localStorage.setItem(save.key, JSON.stringify(root)); save.loadAll();
  const plan = {};   // 角色序号 → { lv, gear, job }；有新建角色时只处理新建的
  if (NEW.length) { for (const n of NEW) { const e = checkCharName(n.name); if (e) throw new Error(n.name + '：' + e); save.newGame(n.cls, n.name); save.persist(); plan[save.chars.length - 1] = n; } save.loadAll(); }
  const report = [];
  for (let i = 0; i < save.chars.length; i++) {
    if (NEW.length && !plan[i]) continue;
    const PL = plan[i] || { lv: MAX_LVL, gear: 'max' }, LV = PL.lv;
    save.select(i); const cls = save.data.cls; if (PL.job) JOBS[cls] = PL.job;
    for (const k of ['spr:' + cls]) await loadBundles([k]);
    game.player = makePlayer(cls); save.apply(); const p = game.player;
    // 等级 / 转职 / 觉醒
    game.lvl = LV; game.exp = 0;
    const fl = save.data.flags ??= {}; if (LV >= 21) fl.awaken = true; if (LV >= 26) fl.awaken2 = true; if (LV >= 30) fl.awaken3 = true;   // 觉醒等级：21 / 26 / 30
    // 任务：本职业能做的非每日任务全部完成
    const d = qdata(); let qn = 0;
    for (const id in QUESTS) { const q = QUESTS[id]; if (q.type === 'daily' || (q.cls && q.cls !== cls) || (q.lvl || 1) > LV) continue; if (!d.questDone[id]) { d.questDone[id] = Date.now(); qn++; } delete d.quests[id]; }
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
    // 其他技能的前置 BUFF（狂暴之力、流心等：技能 req 依赖它）优先上栏，否则一栏技能都放不出来
    const gate = new Set(); for (const id of actives) { const S = SKILLS[id]; if (!S.req) continue; for (const g of actives) if (SKILLS[g].buff && S.req.toString().includes("'" + g + "'")) gate.add(g); }
    if (actives.includes('frenzy')) gate.add('frenzy');
    for (const g of gate) if (!keep.includes(g)) { const k = bar.findIndex((id, i) => i < N - aw.length && id && !gate.has(id)); if (k >= 0 && !bar.slice(0, N - aw.length).includes(null)) { keep.splice(keep.indexOf(bar[k]), 1); bar[k] = null; } }
    const rank = id => (gate.has(id) ? 5000 : 0) + (SKILLS[id].job ? 1000 : 0) + (SKILLS[id].lvReq || 0);
    const rest = actives.filter(id => !SKILLS[id].awaken && !keep.includes(id)).sort((a, b) => rank(b) - rank(a));
    const front = bar.slice(0, N - aw.length); for (let k = 0; k < front.length && rest.length; k++) if (!front[k]) front[k] = rest.shift();
    game.skillBar = front.concat(aw);
    // 装备：按装备对比同一套指标挑最强（单件 + 整套），全身 +12
    const type = mainDmgType(p), old = { ...inv.equip };
    const GEAR = SLOTS.filter(s => !s.startsWith('av_'));
    const mk = k => { const it = makeItem(k, 1); if (!it) return null; if (PL.gear === 'max' && !ITEMS[k].noEnhance && it.slot !== 'title') it.enh = 12; normalizeItem(it); if (it.durMax) it.dur = it.durMax; return it; };
    const cand = {}; for (const s of GEAR) cand[s] = [];
    for (const k in ITEMS) { const D = ITEMS[k]; if (D.kind !== 'equip' || !GEAR.includes(D.slot) || (D.lvl || 1) > LV) continue;
      if (PL.gear === 'normal' && ((D.rar || 0) > 1 || D.slot === 'title' || (D.lvl || 1) < LV - 6)) continue;   // 普通装备：普通 / 高级品级、接近当前等级、不要称号
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
}, { cloud, JOBS, BONUS, NEW });
fs.writeFileSync(S + '/maxed.json', JSON.stringify(out.saved));
for (const r of out.report) console.log(JSON.stringify(r, null, 0));
console.log('errors:', logs.filter(l => l.type === 'pageerror').map(l => l.text.slice(0, 200)));
await browser.close();
