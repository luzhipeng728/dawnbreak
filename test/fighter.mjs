// 格斗家（男）B0 骨架测试（docs/CLASS_PLAN_FIGHTER.md §4.1）。node test/fighter.mjs [save,ids,feel,switch,smoke]（默认全部，约 1 分钟）
//   save   存档安全（#19 #20）：老三职业存档读写和旧算法逐字节一致；新建格斗家往返；不认识 / 没开放职业的角色原样保留（老页面写回也不丢）、选角显示“需要更新”
//   ids    id 预留表 / 转职登记 / 武器类型 / 动画契约
//   feel   武器手感（判定距离、臂铠物理技能 MP·冷却惩罚、拳套转职限制）、光暗抗、四维
//   switch 开放开关：ready:false 选角“即将开放”、J.ready:false 转职窗口不显示、?fighter=1 强制开放
//   smoke  ?fighter=1 从创建角色界面建格斗家 → 城镇 → 洛兰 → 走动 / 普攻（矢量占位模型），不报错
import { launch, URL_BASE } from './lib.mjs';
const MODES = (process.argv[2] || 'save,ids,feel,switch,smoke').split(',');
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
    const otherPre = Object.keys(SKILLS).filter(id => /^f[nsbg]?_/.test(id) && SKILLS[id].cls !== 'fighter');   // 别的职业没人占用这些前缀（格斗家自己的 B3~B7 技能不算）
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
    game.lvl = 15; const avail = jobAvailable(NPCS.fengzhen); menus.open('job', NPCS.fengzhen); await sleep(250);   // Lv15 找风振：转职窗口 4 个方向（开发开关下）
    const cards = document.querySelectorAll('.jobcard').length; menus.close('job'); game.lvl = 1;
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
console.log(fail ? `${fail} 项失败` : '全部通过');
process.exit(fail ? 1 : 0);
