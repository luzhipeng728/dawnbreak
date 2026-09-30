// 格斗家（男）骨架（B0）+ 基础职业（B3）测试（docs/CLASS_PLAN_FIGHTER.md §4.1）。node test/fighter.mjs [save,ids,feel,switch,smoke,base]（默认全部，约 1.5 分钟）
//   save   存档安全（#19 #20）：老三职业存档读写和旧算法逐字节一致；新建格斗家往返；不认识 / 没开放职业的角色原样保留（老页面写回也不丢）、选角显示“需要更新”
//   ids    id 预留表 / 转职登记 / 武器类型 / 动画契约
//   feel   武器手感（判定距离、臂铠物理技能 MP·冷却惩罚、拳套转职限制）、光暗抗、四维
//   switch 开放开关：ready:false 选角“即将开放”、J.ready:false 转职窗口不显示、?fighter=1 强制开放
//   smoke  ?fighter=1 从创建角色界面建格斗家 → 城镇 → 洛兰 → 走动 / 普攻（矢量占位模型），不报错
import { launch, URL_BASE } from './lib.mjs';
const MODES = (process.argv[2] || 'save,ids,feel,switch,smoke,base').split(',');
let fail = 0;
const report = (name, ok, info) => { if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${JSON.stringify(info)}`); };
const noErr = (logs, tag) => { const e = logs.filter(l => l.type === 'pageerror' || l.type === 'error'); report(`无报错（${tag}）`, e.length === 0, e.slice(0, 3)); };
const ready = page => page.waitForFunction(() => window.__READY, null, { timeout: 30000 });

// ---------------- save ----------------
if (MODES.includes('save')) {
  const { browser, page, logs } = await launch({ width: 1280, height: 720 });
  await page.goto(`${URL_BASE}?mute`); await ready(page);
  // 1) 老三职业存档：真实新建的 3 个角色 + 老版本（v1 / v3）的角色 + 身上带点券 → 新代码 loadAll 的结果和旧算法（逐行照抄旧代码）一致；再读写一次不变
  const old = await page.evaluate(() => {
    for (const [c, n] of [['sword', '剑士甲'], ['gun', '枪手乙'], ['mage', '法师丙']]) save.newGame(c, n);
    const d = JSON.parse(localStorage.getItem(save.key));
    d.chars.push({ v: 1, cls: 'sword', name: '一代剑士', lvl: 12, exp: 10, sp: 20, gold: 300, skillLv: { upslash: 2 }, skillBar: ['upslash'], inv: [], equip: {}, created: 1700000000000, cera: 30 });
    d.chars.push({ v: 3, cls: 'gun', name: '三代枪手', lvl: 25, sp: 0, gold: 900, skillLv: { g_knee: 3 }, skillBar: ['g_knee', null], inv: [{ key: 'tk_maxlv', n: 1, kind: 'use' }], equip: {}, created: 1700000000001, shop: { shard: 4, gcoin: 2 } });
    d.acct = { cera: 5 };
    localStorage.setItem(save.key, JSON.stringify(d));
    const raw = localStorage.getItem(save.key);
    // 旧算法（B0 之前的 save.js loadAll + mergeAcctCurrency，逐行照抄）
    const R = JSON.parse(raw); save.chars = R.chars; save.acct = R.acct || {};
    const chars = save.chars.filter(c => c && CLASSES[c.cls]).map(c => save.migrate({ ...save.defaults(c.cls), ...c, v: c.v || 1, opts: { ...save.defaults().opts, ...(c.opts || {}) } }));
    for (const c of chars) if (!c.name || !String(c.name).trim()) c.name = CLASSES[c.cls].name;
    const A = save.acct; A.cera = A.cera || 0; A.shard = A.shard || 0; A.gcoin = A.gcoin || 0; A.maxlv = A.maxlv || 0;
    for (const c of chars) for (const k of ['inv', 'storage']) if (Array.isArray(c[k])) c[k] = c[k].filter(it => { if (it && it.key === 'tk_maxlv') { A.maxlv += it.n || 1; return false; } return true; });
    for (const c of chars) { A.cera += c.cera || 0; c.cera = 0; if (c.shop) { A.shard += c.shop.shard || 0; A.gcoin += c.shop.gcoin || 0; c.shop.shard = 0; c.shop.gcoin = 0; } }
    const noId = s => s.replace(/"id":\d+/g, '"id":0');   // 老版本升级时补发的药剂带自增 id，两次运行的编号不同
    const oldOut = noId(JSON.stringify({ v: SAVE_V, cur: R.cur, chars, acct: A }));
    // 新代码
    localStorage.setItem(save.key, raw); save.loadAll(); save.persist();
    const newOut = noId(localStorage.getItem(save.key));
    save.loadAll(); save.persist();
    return { same: oldOut === newOut, n: JSON.parse(newOut).chars.length, again: noId(localStorage.getItem(save.key)) === newOut, acct: JSON.parse(newOut).acct, len: [oldOut.length, newOut.length] };
  });
  report('老三职业存档：新代码读写 = 旧算法（逐字节），再读写一次不变', old.same && old.again && old.n === 5, old);
  // 2) 格斗家：?fighter=1 新建、进城、存档
  await page.goto(`${URL_BASE}?mute&fighter=1`); await ready(page);
  const made = await page.evaluate(async () => {
    save.newGame('fighter', '格斗测试'); await startGame('fighter'); save.write();
    const cls = game.player.cls, wpn = inv.equip.weapon && inv.equip.weapon.key;
    save.live = false; save.loadAll(); save.persist();   // 刷新一次（第一次读档会补上装备 2.0 的迁移标记），之后应当原样往返
    const d = JSON.parse(localStorage.getItem(save.key)); return { n: d.chars.length, f: JSON.stringify(d.chars.find(c => c.cls === 'fighter')), cls, wpn };
  });
  report('?fighter=1 新建格斗家并进城（初始武器手套）', made.n === 6 && !!made.f && made.cls === 'fighter' && made.wpn === 'knuckle_1_0', { n: made.n, cls: made.cls, wpn: made.wpn });
  // 3) 老页面 / 没开放时读到格斗家 + 不认识的职业（以后的新职业）：原样保留、选角“需要更新”、写回也不改
  const priest = { v: 9, cls: 'priest', name: '未来的圣职者', lvl: 44, future: { a: [1, 2, 3] }, cera: 50, inv: [{ key: 'tk_maxlv', n: 2 }] };
  await page.evaluate(p => { save.live = false; const d = JSON.parse(localStorage.getItem(save.key)); d.chars[4] = p; localStorage.setItem(save.key, JSON.stringify(d)); }, priest);   // 换掉第 5 个角色（角色位上限 6）   // 先停写（离开页面时的自动存档会把注入的角色盖掉）
  await page.goto(`${URL_BASE}?mute`); await ready(page);
  const stale = await page.evaluate(async priest => {
    const before = JSON.parse(localStorage.getItem(save.key)), fB = before.chars.find(c => c.cls === 'fighter');
    save.loadAll(); const n = save.chars.length, fi = save.chars.findIndex(c => c.cls === 'fighter'), pi = save.chars.findIndex(c => c.cls === 'priest');
    const rawKept = JSON.stringify(save.chars[fi]) === JSON.stringify(fB) && JSON.stringify(save.chars[pi]) === JSON.stringify(priest);
    // 选角界面：两个“需要更新”，双击不进游戏
    menus.open('charselect'); await new Promise(r => setTimeout(r, 300));
    const off = [...document.querySelectorAll('#charsel .cslot.off .job')].map(e => e.textContent);
    document.querySelector(`#charsel .cslot[data-i="${fi}"]`).dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); await new Promise(r => setTimeout(r, 300));
    const blocked = !game.player && menus.isOpen('charselect');
    // 用老角色玩一下再写回（老页面写回云端的情形）
    menus.close('charselect'); save.select(0); save.apply(); await startGame(save.data.cls); game.gold += 123; save.write();
    const after = JSON.parse(localStorage.getItem(save.key));
    const keep = JSON.stringify(after.chars.find(c => c.cls === 'fighter')) === JSON.stringify(fB) && JSON.stringify(after.chars.find(c => c.cls === 'priest')) === JSON.stringify(priest);
    const local = cloudSave.localChars().map(c => c.cls);
    return { n, rawKept, off, blocked, keep, nAfter: after.chars.length, local, priestCera: after.chars.find(c => c.cls === 'priest').cera, acctMaxlv: after.acct.maxlv };
  }, priest);
  report('没开放 / 不认识职业的角色：原样保留（不升级、不改数据）', stale.n === 6 && stale.rawKept && stale.nAfter === 6 && stale.priestCera === 50, stale);
  report('选角显示“需要更新”、不能进入', stale.off.length === 2 && stale.off.every(t => t === '需要更新') && stale.blocked, { off: stale.off, blocked: stale.blocked });
  report('老页面玩别的角色再写回：格斗家 / 未知职业的角色逐字节不变；本机上传列表也带上', stale.keep && stale.local.includes('fighter') && stale.local.includes('priest'), { keep: stale.keep, local: stale.local });
  // 4) 开放后（?fighter=1）读回：格斗家照常进游戏，数据和写下去时一致
  await page.goto(`${URL_BASE}?mute&fighter=1`); await ready(page);
  const back = await page.evaluate(async F => {
    save.loadAll(); const i = save.chars.findIndex(c => c.cls === 'fighter'), same = JSON.stringify(save.chars[i]) === F;
    save.select(i); save.apply(); await startGame('fighter');
    return { same, cls: game.player.cls, name: save.data.name, scene: game.scene };
  }, made.f);
  report('格斗家存档往返：开放后读回数据不变、能进游戏', back.same && back.cls === 'fighter' && back.name === '格斗测试' && back.scene === 'town', back);
  noErr(logs, 'save');
  await browser.close();
}

// ---------------- ids / 登记 ----------------
if (MODES.includes('ids')) {
  const { browser, page, logs } = await launch({ width: 960, height: 540 });
  await page.goto(`${URL_BASE}?mute`); await ready(page);
  const R = await page.evaluate(() => {
    const I = FIGHTER_IDS, all = [...I.base, ...I.jobs.flatMap(j => I[j])];
    const pre = { base: 'f_', ...Object.fromEntries(I.jobs.map(j => [j, I.prefix[j]])) };
    const badPre = Object.entries({ base: I.base, ...Object.fromEntries(I.jobs.map(j => [j, I[j]])) }).flatMap(([k, L]) => L.filter(id => !id.startsWith(pre[k])));
    const otherPre = Object.keys(SKILLS).filter(id => /^f[nsbg]?_/.test(id) && !all.includes(id));   // 用这些前缀的技能都在预留表里（B3~B7 各自实装）
    const C = CLASSES.fighter, J = C.jobs;
    const jobs = Object.fromEntries(Object.entries(J).map(([k, v]) => [k, { ready: v.ready, armor: v.armor, dmg: v.dmgType || 'phys', skills: v.skills.length }]));
    const wt = Object.keys(WTYPES).filter(k => WTYPES[k].cls === 'fighter');
    const clash = Object.keys(JOB_ARMOR).filter(k => I.jobs.includes(k)).concat(...Object.keys(CLASSES).filter(c => c !== 'fighter').map(c => Object.keys(CLASSES[c].jobs || {}).filter(k => I.jobs.includes(k))));
    const A = SPR_ANIMS.fighter, frames = Object.values(A).flatMap(a => a.frames || a.map(x => x[0]));
    const base = new Set(Object.values(BASE_ANIMS).flatMap(a => a.frames || a.map(x => x[0])));
    const badFrames = [...new Set(frames)].filter(f => !base.has(f) && !f.startsWith('f_') && !['idle', 'jump2', 'jump3', 'run3', 'charge'].includes(f));
    return { n: all.length, uniq: new Set(all).size, counts: [I.base.length, ...I.jobs.map(j => I[j].length)], badPre, otherPre, jobs, ready: C.ready, wt, boxJobs: WTYPES.boxing.jobs, start: CLASS_START_WEAPON.fighter,
      clash, anims: Object.keys(A).length, badFrames, clips: ['atk1', 'atk2', 'atk3', 'atk4', 'dash', 'jatk', 'crouch'].every(n => CLIPS.fighter[n]), base4: CLASS_BASE4.fighter.str[0], mentor: JOB_MENTOR.fighter,
      feng: { job: NPCS.fengzhen.services.includes('job'), jobFor: NPCS.fengzhen.jobFor }, duel: !!DUEL_BASE.fighter, av: !!AVATAR_CLS.fighter };
  });
  report('技能 id 预留 130 个（15 / 29 / 28 / 30 / 28）、不重复、前缀对、没被占用', R.n === 130 && R.uniq === 130 && R.counts.join() === '15,29,28,30,28' && !R.badPre.length && !R.otherPre.length, { counts: R.counts, badPre: R.badPre, taken: R.otherPre });
  report('转职登记：4 个都 ready:false，精通 布 / 轻 / 重 / 轻，气功 / 街霸魔法', R.ready === false && Object.values(R.jobs).every(j => j.ready === false) && R.jobs.nenmaster.armor === 'cloth' && R.jobs.striker.armor === 'light' && R.jobs.brawler.armor === 'heavy' && R.jobs.grappler.armor === 'light'
    && R.jobs.nenmaster.dmg === 'mag' && R.jobs.brawler.dmg === 'mag' && R.jobs.striker.dmg === 'phys' && R.jobs.grappler.dmg === 'phys' && !R.clash.length, { jobs: R.jobs, clash: R.clash });
  report('武器 5 类（拳套只给散打）、初始手套、力量 7、导师风振、决斗 / 外观登记', R.wt.join() === 'knuckle,boxing,claw,tonfa,gauntlet' && R.boxJobs.join() === 'striker' && R.start === 'knuckle' && R.base4 === 7 && R.mentor === 'fengzhen' && R.feng.job && R.feng.jobFor === 'fighter' && R.duel && R.av, { wt: R.wt, box: R.boxJobs, start: R.start, str: R.base4, mentor: R.mentor, feng: R.feng, duel: R.duel, av: R.av });
  report('动画契约：片段齐全、职业帧一律 f_ 前缀、占位骨骼片段在', R.anims >= 40 && !R.badFrames.length && R.clips, { anims: R.anims, bad: R.badFrames });
  noErr(logs, 'ids');
  await browser.close();
}

// ---------------- feel：武器手感 / 属性 ----------------
if (MODES.includes('feel')) {
  const { browser, page, logs } = await launch({ width: 960, height: 540 });
  await page.goto(`${URL_BASE}?test&cls=fighter&fighter=1&mobs=0&mute`); await ready(page);
  const R = await page.evaluate(() => {
    game.paused = true; const p = game.player, run = n => { for (let i = 0; i < n; i++) step(1 / 60); };
    const wear = key => { inv.equip.weapon = makeItem(key); recalcStats(p); run(20); };
    const out = { res: p.res, str: classBase4('fighter', 1, null).str };
    wear('knuckle_1_0'); out.knuckle = { reach: p.acts.atk1.hits[0].box[1], aspd: +p.aspd.toFixed(2), cspd: +p.cspd.toFixed(2) };
    wear('claw_1_0'); out.claw = { reach: p.acts.atk1.hits[0].box[1], stun: p.acts.atk1.hits[0].stun, aspd: +p.aspd.toFixed(2), cspd: +p.cspd.toFixed(2) };
    wear('tonfa_1_0'); const defT = p.def; wear('claw_1_0'); out.tonfaDef = +(defT / p.def).toFixed(3);
    // 臂铠：物理技能 MP / 冷却 ×1.2 / ×1.1，抓取技能不受影响；其他武器不变
    defSkill('_t_phys', { name: '物理', cls: 'fighter', lvReq: 1, mp: 100, cd: 10, type: 'phys', act: () => ({ name: 't', dur: 0.1, hits: [] }) });
    defSkill('_t_grab', { name: '抓取', cls: 'fighter', lvReq: 1, mp: 100, cd: 10, type: 'phys', grab: true, act: () => ({ name: 't', dur: 0.1, hits: [] }) });
    game.skillLv._t_phys = game.skillLv._t_grab = 1;
    const cast = id => { p.cool = {}; p.mp = p.mpMax = 9999; p.setState('idle'); p.act = null; castSkill(p, id); return { mp: 9999 - p.mp, cd: +(p.cool[id] / p.cdMul).toFixed(2) }; };
    wear('gauntlet_1_0'); out.gPhys = cast('_t_phys'); out.gGrab = cast('_t_grab');
    wear('knuckle_1_0'); out.kPhys = cast('_t_phys');
    delete SKILLS._t_phys; delete SKILLS._t_grab;
    // 拳套：格斗家没转职 / 别的转职不能装，散打能装
    const box = makeItem('boxing_1_0'); inv.items.push(box);
    game.job = null; out.boxNone = inv.canWear(box, true); game.job = 'grappler'; out.boxGrap = inv.canWear(box, true); game.job = 'striker'; out.boxStr = inv.canWear(box, true); game.job = null;
    out.tip = wtypeJobText('boxing');
    return out;
  });
  report('光抗 +20 / 暗抗 -20、初始力量 7', R.res.light === 20 && R.res.dark === -20 && R.str === 7, { res: R.res, str: R.str });
  report('武器手感：爪的判定更远、硬直更长；手套攻速 / 施放最快', R.claw.reach > R.knuckle.reach * 1.25 && R.claw.stun > 0.33 && Math.abs(R.knuckle.aspd - R.claw.aspd - 0.14) < 0.005 && Math.abs(R.knuckle.cspd - R.claw.cspd - 0.05) < 0.005, { knuckle: R.knuckle, claw: R.claw });
  report('东方棍附带物防 +5%', Math.abs(R.tonfaDef - 1.05) < 0.01, { ratio: R.tonfaDef });
  report('臂铠：物理技能 MP ×1.2 / 冷却 ×1.1，抓取不受影响；手套不变', R.gPhys.mp === 120 && Math.abs(R.gPhys.cd - 11) < 0.01 && R.gGrab.mp === 100 && Math.abs(R.gGrab.cd - 10) < 0.01 && R.kPhys.mp === 100 && Math.abs(R.kPhys.cd - 10) < 0.01, { g: R.gPhys, grab: R.gGrab, k: R.kPhys });
  report('拳套只有散打能装', !R.boxNone && !R.boxGrap && R.boxStr && R.tip === '散打', { none: R.boxNone, grappler: R.boxGrap, striker: R.boxStr, tip: R.tip });
  noErr(logs, 'feel');
  await browser.close();
}

// ---------------- switch：开放开关 ----------------
if (MODES.includes('switch')) {
  const { browser, page, logs } = await launch({ width: 1280, height: 720 });
  await page.goto(`${URL_BASE}?mute`); await ready(page);
  const off = await page.evaluate(async () => {
    menus.open('newgame'); await new Promise(r => setTimeout(r, 200));
    const card = document.querySelector('#newgame .clscard[data-cls="fighter"]');
    const out = { open: clsOpen('fighter'), classes: openClasses(), card: !!card, off: card && card.classList.contains('off'), txt: card && card.textContent, sel: menus.ngCls, jobs: jobsOf('fighter'), duel: openClasses().includes('fighter') };
    card.click(); await new Promise(r => setTimeout(r, 100)); out.selAfter = menus.ngCls; menus.close('newgame');
    // 职业开放、转职还没开放：转职窗口没有方向；开一个就只显示那一个
    CLASSES.fighter.ready = true; out.jobsClassOnly = jobsOf('fighter'); CLASSES.fighter.jobs.grappler.ready = true; out.jobsOne = Object.keys(jobsOf('fighter') || {});
    CLASSES.fighter.ready = false; CLASSES.fighter.jobs.grappler.ready = false;
    out.swordJobs = jobsOf('sword') === CLASSES.sword.jobs;   // 老职业：原样返回同一个对象
    out.drop = Array.from({ length: 300 }, () => rollEquip({ slot: 'weapon', lvl: 20, cls: 'sword' })).filter(it => it && it.cls === 'fighter').length;
    out.shop = SHOPS.linus.tabs[0].goods(20).filter(k => ITEMS[k].cls === 'fighter').length;
    return out;
  });
  report('没开放：选角“即将开放”、点不了、不进随机决斗、转职窗口没有方向', !off.open && off.card && off.off && off.txt.includes('即将开放') && off.sel !== 'fighter' && off.selAfter !== 'fighter' && off.jobs === null && !off.duel && !off.classes.includes('fighter'), off);
  report('J.ready：职业开放后转职逐个开放；老职业不受影响', off.jobsClassOnly === null && off.jobsOne.join() === 'grappler' && off.swordJobs, { classOnly: off.jobsClassOnly, one: off.jobsOne, sword: off.swordJobs });
  report('没开放职业的武器不掉落、不上架', off.drop === 0 && off.shop === 0, { drop: off.drop, shop: off.shop });
  await page.goto(`${URL_BASE}?mute&fighter=1`); await ready(page);
  const on = await page.evaluate(async () => {
    menus.open('newgame'); await new Promise(r => setTimeout(r, 200));
    const card = document.querySelector('#newgame .clscard[data-cls="fighter"]'); card.click(); await new Promise(r => setTimeout(r, 150));
    const out = { open: clsOpen('fighter'), off: document.querySelector('#newgame .clscard[data-cls="fighter"]').classList.contains('off'), sel: menus.ngCls, jobs: Object.keys(jobsOf('fighter') || {}), ngjobs: document.querySelectorAll('#newgame .ngjob').length, shop: NPCS.fengzhen.services.includes('shop:fengzhen') };
    menus.close('newgame'); return out;
  });
  report('?fighter=1：可以选格斗家、4 个转职都显示、风振挂出武器店', on.open && !on.off && on.sel === 'fighter' && on.jobs.length === 4 && on.ngjobs === 4 && on.shop, on);
  noErr(logs, 'switch');
  await browser.close();
}

// ---------------- smoke：?fighter=1 建角色 → 城镇 → 地下城，走动 / 普攻 ----------------
if (MODES.includes('smoke')) {
  const { browser, page, logs } = await launch({ width: 1280, height: 720 });
  await page.goto(`${URL_BASE}?mute&fighter=1`); await ready(page); await page.waitForTimeout(300);
  await page.click('text=进入游戏'); await page.waitForFunction(() => menus.isOpen('charselect'));
  await page.click('#charsel button:has-text("创建角色")'); await page.waitForFunction(() => menus.isOpen('newgame'));
  await page.click('#newgame .clscard[data-cls="fighter"]'); await page.waitForTimeout(200);
  await page.fill('#newgame input.txt', '风拳小子'); await page.click('text=创建并开始');
  await page.waitForFunction(() => game.scene === 'town' && game.player, null, { timeout: 30000 });
  await page.evaluate(() => { if (menus.isOpen('help')) menus.close('help'); });
  const town = await page.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    for (const w of ['skills', 'inv', 'status']) { menus.open(w); await sleep(150); menus.close(w); }   // 技能 / 背包 / 属性窗口（格斗家还没有技能）
    // Lv15 + 做完风振的「风拳流 - 出师之战」（B8 的转职试炼）找风振：转职窗口 4 个方向（开发开关下）
    game.lvl = 15; save.data.questDone.q_job_fighter_final = 1; const avail = jobAvailable(NPCS.fengzhen); menus.open('job', NPCS.fengzhen); await sleep(250);
    const cards = document.querySelectorAll('.jobcard').length; menus.close('job'); game.lvl = 1; delete save.data.questDone.q_job_fighter_final;
    return { cls: game.player.cls, model: game.player.model.constructor.name, name: save.data.name, avail, cards };
  });
  await page.evaluate(() => enterDungeon('lorien', 0));
  await page.waitForFunction(() => game.scene === 'dungeon' && game.dungeon && game.player, null, { timeout: 30000 }); await page.waitForTimeout(800);
  await page.evaluate(() => { const p = game.player; window.__acts = new Set(); window.__hits = 0; window.__x0 = p.x; setInterval(() => { if (p.act) __acts.add(p.act.name); }, 10); const oh = game.onPlayerHit; game.onPlayerHit = function () { __hits++; return oh.apply(this, arguments); }; });
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(700); await page.keyboard.up('ArrowRight');
  const moved = await page.evaluate(() => Math.round(game.player.x - __x0));
  // 走到最近的怪面前连按 X（4 段普攻）+ 跑攻 + 跳攻
  for (let r = 0; r < 4; r++) {
    await page.evaluate(() => { const p = game.player, m = ents.filter(e => e.team === 'e' && !e.dead).sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0]; if (m) { p.x = m.x - 60; p.y = m.y; p.face = 1; } });
    for (let i = 0; i < 6; i++) { await page.keyboard.press('KeyX'); await page.waitForTimeout(120); }
    await page.waitForTimeout(300);
  }
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(40); await page.keyboard.down('ArrowRight'); await page.waitForTimeout(250); await page.keyboard.press('KeyX'); await page.keyboard.up('ArrowRight'); await page.waitForTimeout(500);
  await page.keyboard.press('KeyC'); await page.waitForTimeout(120); await page.keyboard.press('KeyX'); await page.waitForTimeout(800);
  const R = await page.evaluate(() => ({ acts: [...__acts], hits: __hits, scene: game.scene, frameErrs: typeof frameErrs !== 'undefined' ? frameErrs.length : 0 }));
  report('?fighter=1 从创建界面建格斗家进城（矢量占位模型）；技能 / 背包 / 属性窗口能开；Lv15 风振转职窗口 4 个方向', town.cls === 'fighter' && town.name === '风拳小子' && town.model !== 'SpriteModel' && town.avail && town.cards === 4, town);
  report('地下城里走动 / 4 段普攻 / 跑攻 / 跳攻都能放、打得到怪', moved > 60 && ['atk1', 'atk2', 'atk3', 'atk4', 'dash', 'jatk'].every(a => R.acts.includes(a)) && R.hits > 3 && R.scene === 'dungeon' && !R.frameErrs, { moved, ...R });
  noErr(logs, 'smoke');
  await browser.close();
}
// ---------------- base：基础职业（B3）：每个技能放得出 / 打得中 / 冷却 / MP、指令、抓取、疾风追击、取消白名单、分身、鹰踏、蹲伏、旋风腿…… ----------------
if (MODES.includes('base')) {
  const { browser, page, logs } = await launch({ width: 960, height: 540 });
  await page.goto(`${URL_BASE}?test&cls=fighter&fighter=1&mobs=0&mute&rawcd`); await ready(page);
  await page.evaluate(() => {
    game.paused = true;
    window.T = {
      run(n) { for (let i = 0; i < n; i++) step(1 / 60); },
      tap(a) { input.virt[a] = 2; T.run(1); delete input.virt[a]; },
      hold(a) { input.virt[a] = 1; }, release(a) { delete input.virt[a]; },
      clear() { for (const e of ents) if (e !== game.player) e.remove = true; T.run(1); projs.length = 0; if (typeof clearAllSummons === 'function') clearAllSummons('round'); },
      reset(p = game.player) { for (const k in input.virt) delete input.virt[k]; input.buf.length = 0; input.dirHist.length = 0;
        Object.assign(p, { x: 300, y: 100, z: 0, vx: 0, vy: 0, vz: 0, face: 1, act: null, invul: 0, superArmor: 0, hitstop: 0, dead: false, cool: {}, buffs: {}, charges: {}, bsCd: 0, reboundCd: 0, techHold: false, stun: 0, airAtk: 0, _fNoAW: false, _fAwCd: undefined, drawFlip: false });
        p.hp = p.hpMax; p.mp = p.mpMax = 99999; p.mpRegen = 1e-9; p.setState('idle'); resetCmb(p); T.run(2); },   // MP 不回复：量 MP 消耗
      mob(x = 370, y = 100, o = {}) { const m = spawnMonster('goblin', x, y); m.control = null; m.invul = 0; m.z = 0; m.vz = 0; m.hp = m.hpMax = 1e9; m.evade = 0; m.setState('idle'); Object.assign(m, o); return m; },
      until(f, n = 240) { for (let i = 0; i < n; i++) { if (f()) return i; T.run(1); } return -1; },
      idle(n = 400) { const p = game.player; T.until(() => p.st !== 'act' && p.z <= 0 && p.st !== 'jump' && !p.hitstop, n); T.run(2); },
    };
    const L = game.skillLv; for (const id of CLASSES.fighter.skills) if (SKILLS[id]) L[id] = SKILLS[id].passive ? 1 : 5; L.c_bsup = 0; L.f_chain2 = 0; L.f_iron = 0;
    game.skillBar = ['f_highkick', 'f_hammer', 'f_lowkick', 'f_knee', 'f_clone', 'f_chain', 'f_flash', 'f_airwalk', 'f_nenshot', 'f_sand', 'f_crouch', 'f_seismic', 'f_tornado', null];
    inv.equip.weapon = null; recalcStats(game.player); game.player.mp = game.player.mpMax = 99999;
  });
  // 1) 每个主动技能：技能栏放出来、打中面前的木桩、冷却 = 官方值（?rawcd）、MP = 表里的值
  const R1 = await page.evaluate(() => {
    const p = game.player, out = {};
    const skip = { f_clone: 'summon', f_flash: 'move', f_crouch: 'dodge' };
    for (let i = 0; i < game.skillBar.length; i++) {
      const id = game.skillBar[i]; if (!id) continue; T.clear(); T.reset();
      const m = T.mob(id === 'f_sand' ? 360 : 370), S = SKILLS[id];
      if (S.airOnly) { p.vz = 420; p.z = 1; p.setState('jump'); p.x = m.x - 40; T.run(14); }
      const mp0 = p.mp, hp0 = m.hp; T.tap('s' + i); const cast = !!p.act && p.act.skill === id, cool = +(p._fAwCd ?? p.cool[id] ?? 0).toFixed(2), mp = mp0 - p.mp;
      T.run(90); out[id] = { cast, hit: m.hp < hp0, mp, cd: cool, want: [S.cd, S.mp], skip: skip[id] || null };
      T.idle();
    }
    return out;
  });
  const bad1 = Object.entries(R1).filter(([id, r]) => !r.cast || (!r.skip && !r.hit) || Math.abs(r.cd - r.want[0]) > 0.01 || (id !== 'f_chain' && r.mp !== r.want[1]));
  report('13 个主动技能：技能栏放得出、打得中木桩（分身 / 瞬步 / 蹲伏除外）、冷却 = 官方值、MP = 表里的值', bad1.length === 0 && Object.keys(R1).length === 13, bad1.length ? Object.fromEntries(bad1) : Object.fromEntries(Object.entries(R1).map(([k, r]) => [k, [r.cd, r.mp, r.hit]])));
  // 2) 官方指令
  const R2 = await page.evaluate(() => {
    const p = game.player, out = {}, got = () => { const s = p.act && (p.act.skill || p.act.name); T.run(1); return s; };
    const go = (name, f) => { T.clear(); T.reset(); f(); out[name] = got(); T.run(60); T.idle(); };
    go('Z', () => T.tap('cmd'));
    go('holdU_Z', () => { T.hold('up'); T.run(14); T.tap('cmd'); T.release('up'); });
    go('tapU_Z', () => { T.tap('up'); T.tap('cmd'); });
    go('holdD_Z', () => { T.hold('down'); T.run(14); T.tap('cmd'); T.release('down'); });
    go('holdF_Z', () => { T.hold('right'); T.run(3); T.tap('cmd'); T.release('right'); });
    go('F_Space', () => { T.hold('right'); T.run(3); T.tap('cmdB'); T.release('right'); });
    go('UF_Space', () => { T.tap('up'); T.tap('right'); T.tap('cmdB'); });
    go('DF_Z', () => { T.tap('down'); T.tap('right'); T.tap('cmd'); });
    go('BF_Z', () => { T.tap('left'); T.tap('right'); T.tap('cmd'); });
    go('DD_C', () => { T.tap('down'); T.run(2); input.virt.down = 2; T.run(1); T.tap('jump'); T.release('down'); });   // 第二下 ↓ 还按着时按 C：蹲伏，不是后跳
    go('D_C', () => { T.hold('down'); T.run(3); T.tap('jump'); T.release('down'); });   // 只按一下 ↓ + C：照常后跳
    go('FU_Z', () => { T.tap('right'); T.tap('up'); T.tap('cmd'); });
    go('BDF_C', () => { T.tap('left'); T.tap('down'); T.tap('right'); T.tap('jump'); });
    go('air_Z', () => { T.tap('jump'); T.run(10); T.tap('cmd'); });
    go('run_X', () => { T.tap('right'); T.run(2); input.virt.right = 2; T.run(6); T.tap('attack'); T.release('right'); });   // 双击 → 按住跑动，再按 X = 跑攻
    out.cmdTxt = ['f_hammer', 'f_lowkick', 'f_knee', 'f_clone', 'f_flash', 'f_airwalk', 'f_crouch', 'f_tornado', 'f_chain'].map(id => cmdTextOf(id));
    return out;
  });
  const want2 = { Z: 'f_highkick', holdU_Z: 'f_hammer', holdD_Z: 'f_lowkick', holdF_Z: 'f_knee', F_Space: 'f_clone', UF_Space: 'f_flash', DF_Z: 'f_nenshot', BF_Z: 'f_sand', DD_C: 'f_crouch', D_C: 'back', FU_Z: 'f_seismic', BDF_C: 'f_tornado', air_Z: 'f_airwalk', run_X: 'dash' };
  const bad2 = Object.entries(want2).filter(([k, v]) => R2[k] !== v);
  report('官方指令：Z 上踢 / 按住↑+Z 前踢 / 按住↓+Z 下段踢 / 按住→+Z 膝击 / →+Space 分身 / ↑→+Space 瞬步 / ↓→+Z 念气波 / ←→+Z 抛沙 / ↓↓+C 蹲伏（↓+C 仍是后跳）/ →↑+Z 金刚碎 / ←↓→+C 旋风腿 / 空中 Z 鹰踏；点一下 ↑ 再 Z 不是前踢',
    bad2.length === 0 && R2.tapU_Z === 'f_highkick', { bad: bad2.map(([k, v]) => `${k}:${R2[k]}≠${v}`), tapU: R2.tapU_Z, txt: R2.cmdTxt });
  // 3) 膝击：抓住（霸体也能抓）、抓住期间自己无敌、撞两下后挑空；领主抓不住（只挨一下）
  const R3 = await page.evaluate(() => {
    const p = game.player, out = {}; T.clear(); T.reset(); const m = T.mob(360, 100, { superArmor: 99 });
    castSkill(p, 'f_knee'); let held = false, inv = false, hits = 0; const hp0 = m.hp;
    for (let i = 0; i < 90; i++) { T.run(1); if (m.st === 'held') { held = true; if (p.invul > 0) inv = true; } }
    out.grab = { held, inv, launched: m.z > 20 || m.st === 'air', dmg: m.hp < hp0 }; m.superArmor = 0; T.idle();
    T.clear(); T.reset(); const b = T.mob(360, 100, { boss: true }); const hb = b.hp; castSkill(p, 'f_knee'); let bh = false; for (let i = 0; i < 60; i++) { T.run(1); if (b.st === 'held') bh = true; }
    out.boss = { held: bh, dmg: b.hp < hb, dur: +(p.act ? p.act.dur : 0).toFixed(2) }; T.idle();
    // 拖抓：普攻第 2 段（下段踢）之后按住→+Z 直接接膝击
    T.clear(); T.reset(); T.mob(360); T.tap('attack'); T.run(10); T.tap('attack'); T.run(4); const a2 = p.act && p.act.name; T.hold('right'); T.tap('cmd'); T.until(() => p.act && p.act.skill, 8); T.release('right'); out.drag = [a2, p.act && (p.act.skill || p.act.name)]; T.run(90); T.idle();
    return out;
  });
  report('膝击：抓住霸体的敌人、抓住期间无敌、两下膝撞后挑空；领主抓不住；普攻②后接膝击（拖抓）', R3.grab.held && R3.grab.inv && R3.grab.launched && R3.grab.dmg && !R3.boss.held && R3.boss.dmg && R3.drag[0] === 'atk2' && R3.drag[1] === 'f_knee', R3);
  // 4) 疾风追击：肩撞 → X 追加；学了疾风追击肩撞不击倒；没学疾风连击最多 2 击、学了 4 击；每击耗 MP
  const R4 = await page.evaluate(() => {
    const p = game.player, out = {};
    const dashChain = (presses) => { T.clear(); T.reset(); const m = T.mob(420); p.mp = 1000; p.doAct(p.acts.dash); const seq = []; let downed = false;
      for (let i = 0; i < 200; i++) { if (i >= 14 && i % 8 === 0 && presses-- > 0) input.virt.attack = 2; T.run(1); delete input.virt.attack; const n = p.act && p.act.name; if (n && seq[seq.length - 1] !== n) seq.push(n); if (m.st === 'down' || (m.st === 'air' && m.vz > 0 && p.act && p.act.name === 'dash')) downed = true; }
      const r = { seq: seq.filter(n => n === 'dash' || n.startsWith('fchain')), downed, mp: 1000 - p.mp }; T.idle(); return r; };
    game.skillLv.f_chain = 0; out.noChain = dashChain(0);
    game.skillLv.f_chain = 5; out.chain = dashChain(6);
    game.skillLv.f_chain2 = 1; out.chain2 = dashChain(8); game.skillLv.f_chain2 = 0;
    return out;
  });
  report('疾风追击：没学时肩撞击倒；学了不击倒、肩撞中 X 追加 2 击；疾风连击再 2 击（共 4 击）；每击耗 MP', R4.noChain.downed && !R4.chain.downed && R4.chain.seq.join() === 'dash,fchain1,fchain2' && R4.chain2.seq.join() === 'dash,fchain1,fchain2,fchain3,fchain4' && Math.round(R4.chain.mp) === 16 && Math.round(R4.chain2.mp) === 32, R4);
  // 5) 取消白名单：普攻 → 攻击技能随时；念气波只有气功师、抛沙只有街霸、旋风腿只有散打；分身不能取消普攻；技能 → 技能不行
  const R5 = await page.evaluate(() => {
    const p = game.player, out = {}, bar = id => game.skillBar.indexOf(id);
    // 不放木桩：命中停顿期间不处理输入，会让“能不能取消”量不准
    const tryFromBasic = (id, job) => { T.clear(); T.reset(); game.job = job || null; T.tap('attack'); T.run(4); T.tap('s' + bar(id)); const r = p.act && (p.act.skill || p.act.name); T.run(80); T.idle(); game.job = null; return r; };
    out.high = tryFromBasic('f_highkick'); out.nen = tryFromBasic('f_nenshot'); out.nenNen = tryFromBasic('f_nenshot', 'nenmaster');
    out.sand = tryFromBasic('f_sand'); out.sandBr = tryFromBasic('f_sand', 'brawler'); out.tor = tryFromBasic('f_tornado'); out.torSt = tryFromBasic('f_tornado', 'striker'); out.clone = tryFromBasic('f_clone');
    T.clear(); T.reset(); castSkill(p, 'f_highkick'); T.run(10); T.tap('s' + bar('f_hammer')); out.s2s = p.act && p.act.skill; T.run(60); T.idle();
    // 后跳中可以接旋风腿（官方：后跳后也能用）
    T.clear(); T.reset(); T.hold('down'); T.tap('jump'); T.release('down'); T.run(6); T.tap('s' + bar('f_tornado')); out.backTor = p.act && p.act.skill; T.run(80); T.idle();
    return out;
  });
  report('取消：普攻→上踢可以；念气波只有气功师、抛沙只有街霸、旋风腿只有散打能取消普攻；分身不能；技能→技能不行；后跳中能接旋风腿',
    R5.high === 'f_highkick' && R5.nen !== 'f_nenshot' && R5.nenNen === 'f_nenshot' && R5.sand !== 'f_sand' && R5.sandBr === 'f_sand' && R5.tor !== 'f_tornado' && R5.torSt === 'f_tornado' && R5.clone !== 'f_clone' && R5.s2s === 'f_highkick' && R5.backTor === 'f_tornado', R5);
  // 6) 各技能的机制
  const R6 = await page.evaluate(() => {
    const p = game.player, out = {};
    // 下段踢：打得到倒地的敌人；冲击波打周围（直接被踢中的不吃冲击波）
    T.clear(); T.reset(); const d = T.mob(370); d.setState('down'); d.downTime = 9; const w = T.mob(420, 130); const hd = d.hp, hw = w.hp; let nD = 0; const oh = window.applyHit;
    window.applyHit = function (a, t) { if (t === d) nD++; return oh.apply(this, arguments); };
    castSkill(p, 'f_lowkick'); T.run(40); window.applyHit = oh;
    out.low = { downHit: d.hp < hd, directHits: nD, wave: w.hp < hw }; T.idle();
    // 分身：数量 = 技能等级，嘲讽周围的怪物、7 秒后消失
    T.clear(); T.reset(); const mm = T.mob(700, 100, { control: null }); game.skillLv.f_clone = 3; castSkill(p, 'f_clone'); T.run(60);
    out.clone = { n: summonsOf(p, 'f_clone').length, taunt: !!(mm.status && mm.status.taunt && mm.status.taunt.src && mm.status.taunt.src.skey === 'f_clone'), spread: summonsOf(p, 'f_clone').map(s => Math.round(s.x - p.x)) };
    T.run(60 * 7); out.clone.after7s = summonsOf(p, 'f_clone').length; game.skillLv.f_clone = 5; T.idle();
    // 瞬步：向前 210px；前面有敌人停在敌人面前
    T.clear(); T.reset(); castSkill(p, 'f_flash'); T.run(2); out.flash = Math.round(p.x - 300); T.idle();
    T.clear(); T.reset(); const fm = T.mob(420); castSkill(p, 'f_flash'); T.run(2); out.flashStop = Math.round(fm.x - p.x); T.idle();
    // 鹰踏：踩中弹起、再按踩第二脚；落地后才开始冷却；跳攻后不能用
    T.clear(); T.reset(); const am = T.mob(340); p.vz = 520; p.z = 1; p.setState('jump'); T.run(16); const ha = am.hp; castSkill(p, 'f_airwalk'); let bounce = false, stage2 = false, coolAir = 0, coolLand = null;
    for (let i = 0; i < 150 && coolLand === null; i++) { T.run(1); const a = p.act;
      if (a && a.name === 'f_airwalk' && p.vz > 300) bounce = true;
      if (a && a.name === 'f_airwalk' && a.bT !== undefined && a.stage === 1 && !stage2 && p.actT - a.bT > 0.1) { T.tap('cmd'); stage2 = !!p.act && p.act.stage === 2; }
      if (p.z > 1) coolAir = Math.max(coolAir, p.cool.f_airwalk || 0); else if (p.st !== 'act' && p.st !== 'jump') { T.run(16); coolLand = p.cool.f_airwalk || 0; } }
    T.idle(); out.air = { hit: am.hp < ha, bounce, stage2, coolInAir: +coolAir.toFixed(1), coolLanded: +(coolLand || 0).toFixed(2) };
    T.clear(); T.reset(); p.vz = 520; p.z = 1; p.setState('jump'); p.airAtk = 0; T.run(6); T.tap('attack'); T.run(24); T.tap('cmd'); out.air.afterJatk = p.act && p.act.skill; T.idle();
    // 念气波：光属性魔法、感电；抛沙：失明（几率固定成必中）
    T.clear(); T.reset(); const nm = T.mob(420); castSkill(p, 'f_nenshot'); T.run(40); out.nen = { shock: hasStatus(nm, 'shock') }; T.idle();
    const rnd0 = Math.random; Math.random = () => 0; T.clear(); T.reset(); const sm = T.mob(360); castSkill(p, 'f_sand'); T.run(30); Math.random = rnd0; out.sand = { blind: hasStatus(sm, 'blind') }; T.idle();
    // 蹲伏：受击盒压低、X 肩撞（地下城无敌）、C 起身
    T.clear(); T.reset(); castSkill(p, 'f_crouch'); T.run(4); out.crouch = { h: p.hurtH() }; T.tap('attack'); T.run(2); out.crouch.x = p.act && p.act.name; out.crouch.inv = p.invul > 0; T.run(40); T.idle();
    T.clear(); T.reset(); castSkill(p, 'f_crouch'); T.run(6); T.tap('jump'); T.run(2); out.crouch.up = p.st; T.idle();
    // 金刚碎：落地冲击波把周围的敌人挑到空中
    T.clear(); T.reset(); const q1 = T.mob(400, 100), q2 = T.mob(470, 140); castSkill(p, 'f_seismic'); let up = 0; for (let i = 0; i < 90; i++) { T.run(1); up = Math.max(up, Math.min(q1.z, q2.z)); } out.seismic = { launched: Math.round(up) }; T.idle();
    // 旋风腿：原地不动、身后和身前的敌人都被拉向自己、多段；按跳跃取消
    T.clear(); T.reset(); const tf = T.mob(380), tb = T.mob(240); const x0 = p.x, df0 = tf.x - p.x, db0 = p.x - tb.x; const hf = tf.hp; let nT = 0; const oh2 = window.applyHit;
    window.applyHit = function (a, t) { if (t === tf && a === p) nT++; return oh2.apply(this, arguments); }; castSkill(p, 'f_tornado'); T.run(70); window.applyHit = oh2;
    out.tornado = { moved: Math.round(Math.abs(p.x - x0)), hits: nT, pullF: Math.round(df0 - (tf.x - p.x)), pullB: Math.round(db0 - (p.x - tb.x)) }; T.idle();
    T.clear(); T.reset(); castSkill(p, 'f_tornado'); T.run(15); T.tap('jump'); out.tornado.jumpCancel = p.st; T.idle();
    return out;
  });
  report('下段踢：踢到倒地的敌人；冲击波打到旁边的敌人、被直接踢中的只挨 1 下', R6.low.downHit && R6.low.wave && R6.low.directHits === 1, R6.low);
  report('分身：数量 = 技能等级、嘲讽怪物、7 秒后消失', R6.clone.n === 3 && R6.clone.taunt && R6.clone.after7s === 0, R6.clone);
  report('瞬步：向前 210px；前面有敌人时停在敌人面前', R6.flash === 210 && R6.flashStop > 0 && R6.flashStop < 40, { flash: R6.flash, stopGap: R6.flashStop });
  report('鹰踏：踩中弹起、再按踩出最后一脚；空中冷却挂起、落地才开始；跳攻后不能用', R6.air.hit && R6.air.bounce && R6.air.stage2 && R6.air.coolInAir >= 90 && R6.air.coolLanded > 6.4 && R6.air.coolLanded <= 7 && R6.air.afterJatk !== 'f_airwalk', R6.air);
  report('念气波感电；抛沙失明', R6.nen.shock && R6.sand.blind, { nen: R6.nen, sand: R6.sand });
  report('蹲伏：受击盒压低到倒地高度、X = 无敌肩撞、C 起身', R6.crouch.h <= 22 && R6.crouch.x === 'f_crouchX' && R6.crouch.inv && R6.crouch.up !== 'act', R6.crouch);
  report('金刚碎：冲击波把周围的敌人挑到空中', R6.seismic.launched > 30, R6.seismic);
  report('旋风腿：原地不动、4 段以上、身前身后的敌人都被拉近；按跳跃取消起跳', R6.tornado.moved < 4 && R6.tornado.hits >= 4 && R6.tornado.pullF > 0 && R6.tornado.pullB > 0 && R6.tornado.jumpCancel === 'jump', R6.tornado);
  // 7) 钢筋铁骨（物理伤害减少）、臂铠：物理技能 MP ×1.2、膝击（抓取）不受影响
  const R7 = await page.evaluate(() => {
    const p = game.player, out = {}; T.clear(); T.reset(); const m = T.mob(380); m.atk = 1000; const rnd0 = Math.random; Math.random = () => 0.5;
    const take = () => { p.hp = p.hpMax; p.setState('idle'); p.act = null; p.invul = 0; const h0 = p.hp; applyHit(m, p, { dmg: 1, sure: true, type: 'phys' }, { proj: true }); return h0 - p.hp; };
    let a = 0, b = 0; for (let i = 0; i < 20; i++) a += take(); game.skillLv.f_iron = 10; for (let i = 0; i < 20; i++) b += take(); game.skillLv.f_iron = 0; Math.random = rnd0;
    out.iron = +(b / a).toFixed(3);
    inv.equip.weapon = makeItem('gauntlet_1_0'); recalcStats(p); T.reset(); p.mp = 1000; castSkill(p, 'f_highkick'); out.gHigh = 1000 - p.mp; T.idle(); T.reset(); p.mp = 1000; castSkill(p, 'f_knee'); out.gKnee = 1000 - p.mp; T.idle();
    inv.equip.weapon = null; recalcStats(p); return out;
  });
  report('钢筋铁骨 10 级：物理伤害 -9%；臂铠：上踢 MP ×1.2、膝击（抓取）不变', Math.abs(R7.iron - (1 - 0.093)) < 0.02 && R7.gHigh === 12 && R7.gKnee === 20, R7);
  noErr(logs, 'base');
  await browser.close();
}
console.log(fail ? `${fail} 项失败` : '全部通过');
process.exit(fail ? 1 : 0);
