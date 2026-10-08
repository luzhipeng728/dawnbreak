// 圣职者（男）骨架（B0）+ 基础职业（docs/CLASS_PLAN_PRIEST.md）测试。node test/priest.mjs [switch,ids,party,base,smoke]（默认全部，约 1 分钟）
//   switch 开放开关：圣职者和 4 个转职默认开放，选角 / 转职 / 掉落 / 商店可用；?priest=1（或 ?dev=priest）用于测试跳转
//   ids    id 预留表 / 4 个转职登记（精通 / 伤害类型 / 觉醒名）/ 5 种武器 / 动画契约（每个片段都有骨骼片段）/ 指令表
//   party  队伍原语：hot（持续回复）、life（免死一次）、d.to 单体施放只给目标、partyPick 挑 HP 最低的队员
//   base   11 个基础技能：放得出 / 打得中 / 冷却 = 官方 / MP = 官方；官方指令；虎袭抓取冲刺扔出；跑攻 X 接勾拳追击；取消例外；治疗 / 净化 / 化魔 / 武器手感
//   smoke  ?priest=1 从创建角色界面建圣职者 → 城镇 → 地下城走动 / 普攻 / 技能，不报错
import { launch, URL_BASE } from './lib.mjs';
import fs from 'fs';
const MODES = (process.argv[2] || 'switch,ids,party,base,smoke').split(',');
let fail = 0;
const report = (name, ok, info) => { if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${JSON.stringify(info)}`); };
const noErr = (logs, tag) => { const e = logs.filter(l => l.type === 'pageerror' || l.type === 'error'); report(`无报错（${tag}）`, e.length === 0, e.slice(0, 3)); };
const ready = page => page.waitForFunction(() => window.__READY, null, { timeout: 30000 });
const BASE = ['p_launcher', 'p_smasher', 'p_lucky', 'p_second', 'p_slowheal', 'p_cure', 'p_grab', 'p_purity', 'p_phoenix', 'p_rapture', 'p_emblem'];

// ---------------- switch ----------------
if (MODES.includes('switch')) {
  const { browser, page, logs } = await launch({ width: 1280, height: 720 });
  await page.goto(`${URL_BASE}?mute`); await ready(page);
  const on = await page.evaluate(async () => {
    menus.open('newgame'); await new Promise(r => setTimeout(r, 200));
    const card = document.querySelector('#newgame .clscard[data-cls="priest"]');
    const out = { open: clsOpen('priest'), classes: openClasses(), card: !!card, off: card && card.classList.contains('off'), txt: card && card.textContent, jobs: Object.keys(jobsOf('priest') || {}), fighterOpen: clsOpen('fighter') };
    card.click(); await new Promise(r => setTimeout(r, 100)); out.sel = menus.ngCls; menus.close('newgame');
    out.drop = Array.from({ length: 300 }, () => rollEquip({ slot: 'weapon', lvl: 20, cls: 'sword' })).filter(it => it && it.cls === 'priest').length;
    out.shopLinus = SHOPS.linus.tabs[0].goods(20).filter(k => ITEMS[k].cls === 'priest').length;
    out.grandis = { job: NPCS.grandis.services.includes('job'), shop: NPCS.grandis.services.includes('shop:grandis'), jobFor: NPCS.grandis.jobFor };
    out.crowd = crowdCls().includes('priest');
    return out;
  });
  report('默认开放：选角可选、4 个转职可见、武器掉落 / 商店已接入',
    on.open && on.card && !on.off && on.sel === 'priest' && on.classes.includes('priest') && on.jobs.join() === 'crusader,monk,exorcist,avenger' && on.drop > 0 && on.shopLinus > 0 && on.grandis.job && on.grandis.shop && on.grandis.jobFor === 'priest' && on.fighterOpen, on);
  // 已开放的圣职者旧存档：可以正常打开并保留角色关键数据
  const kept = await page.evaluate(() => {
    const c = { v: 5, cls: 'priest', name: '开发圣职者', lvl: 12, job: null, skillLv: { p_launcher: 3 }, equip: {}, inv: [], cera: 7 };
    save.live = false; save.newGame('sword', '剑士'); const d = JSON.parse(localStorage.getItem(save.key)); d.chars.push(c); localStorage.setItem(save.key, JSON.stringify(d));
    save.loadAll(); save.persist(); const after = JSON.parse(localStorage.getItem(save.key)); const pc = after.chars.find(x => x.cls === 'priest');
    return { kept: !!pc && pc.name === c.name && pc.lvl === c.lvl && pc.skillLv.p_launcher === 3, open: charOpen(pc), n: after.chars.length };
  });
  report('已开放的圣职者旧存档：关键数据保留、可正常打开', kept.kept && kept.open, kept);
  for (const q of ['priest=1', 'dev=priest']) {
    await page.goto(`${URL_BASE}?mute&${q}`); await ready(page);
    const on = await page.evaluate(async () => {
      menus.open('newgame'); await new Promise(r => setTimeout(r, 200));
      const card = document.querySelector('#newgame .clscard[data-cls="priest"]'); card.click(); await new Promise(r => setTimeout(r, 150));
      const out = { open: clsOpen('priest'), off: card.classList.contains('off'), sel: menus.ngCls, jobs: Object.keys(jobsOf('priest') || {}), openJobs: openJobs('priest'), shop: NPCS.grandis.services.includes('shop:grandis'),
        shopGoods: SHOPS.grandis.tabs[0].goods(20).length, wtypes: CLASS_WTYPES('priest').filter(t => clsOpen(WTYPES[t].cls)).length };
      menus.close('newgame');
      const q = devOpenParams(new URLSearchParams()); out.pass = q.toString();
      return out;
    });
    report(`?${q}：选角能选圣职者、4 个转职、歌兰蒂斯挂出武器店、决斗跳转带上开关`, on.open && !on.off && on.sel === 'priest' && on.jobs.join() === 'crusader,monk,exorcist,avenger' && on.shop && on.shopGoods > 0 && on.wtypes === 5 && on.pass.includes('priest=1'), on);
  }
  noErr(logs, 'switch');
  await browser.close();
}

// ---------------- ids ----------------
if (MODES.includes('ids')) {
  const { browser, page, logs } = await launch({ width: 960, height: 540 });
  await page.goto(`${URL_BASE}?mute&priest=1`); await ready(page);
  const r = await page.evaluate(base => {
    const C = CLASSES.priest, I = PRIEST_IDS, J = C.jobs;
    const allIds = Object.keys(SKILLS), clash = {};
    for (const [k, pre] of Object.entries(I.prefix)) clash[k] = allIds.filter(id => id.startsWith(pre) && SKILLS[id].cls !== 'priest');
    const jobs = Object.fromEntries(Object.entries(J).map(([k, j]) => [k, [j.name, masteryOf('priest', k), j.dmgType, j.awakenName, j.awakenName2, j.awakenName3, j.ready]]));
    const otherJobs = Object.keys(CLASSES).filter(c => c !== 'priest').flatMap(c => Object.keys(CLASSES[c].jobs || {}));
    const wt = CLASS_WTYPES('priest'), wOk = wt.every(t => WTYPES[t].name && WTYPES[t].cls === 'priest' && !t.includes('_'));
    const clips = Object.keys(SPR_ANIMS.priest), noClip = clips.filter(n => !CLIPS.priest[n] || !CLIPS.priest[n].keys);
    const cmdIds = C.cmds.map(c => c[1]).filter(id => !SKILLS[id]);
    const cmdTxt = Object.fromEntries(base.map(id => [id, cmdTextOf(id)]));
    return { skills: C.skills.filter(id => id !== 'c_bsup'), start: C.start, clash, jobs, jobClash: Object.keys(J).filter(k => otherJobs.includes(k)), wt, wOk, start0: CLASS_START_WEAPON.priest, mentor: JOB_MENTOR.priest,
      clips: clips.length, noClip, cmdIds, cmdTxt, base4: CLASS_BASE4.priest, armor: masteryOf('priest', null), res: C.res || null, sprCls: SPR_PLAYER_CLS.includes('priest'), shells: typeof PRIEST_HOOKS === 'object' && Object.keys(PRIEST_HOOKS).length };
  }, BASE);
  report('11 个基础技能 id = 预留表；初始技能 空斩打 / 虎袭；前缀没有和别的职业撞', r.skills.join() === BASE.join() && r.start.join() === 'p_launcher,p_smasher' && Object.values(r.clash).every(a => a.length === 0), { skills: r.skills, clash: r.clash });
  report('4 个转职登记：圣骑士 板甲 / 蓝拳 轻甲 / 驱魔 板甲 / 复仇者 重甲，伤害类型、三次觉醒名、ready:true；转职 id 不和别的职业撞',
    r.jobs.crusader[1] === 'plate' && r.jobs.monk[1] === 'light' && r.jobs.exorcist[1] === 'plate' && r.jobs.avenger[1] === 'heavy' && r.jobs.avenger[2] === 'mag' && r.jobs.monk[2] === 'phys'
    && Object.values(r.jobs).every(j => j[3] && j[4] && j[5] && j[6] === true) && r.jobClash.length === 0, r.jobs);
  report('5 种巨兵（十字架 / 念珠 / 图腾 / 镰刀 / 战斧），初始十字架，导师歌兰蒂斯，转职前重甲，四维 6/4/6/6',
    r.wt.join() === 'cross,rosary,totem,scythe,battleaxe' && r.wOk && r.start0 === 'cross' && r.mentor === 'grandis' && r.armor === 'heavy' && r.base4.str[0] === 6 && r.base4.spr[0] === 6, { wt: r.wt, base4: r.base4 });
  report('动画契约：SPR_ANIMS.priest 每个片段都有矢量占位的骨骼片段；指令表的技能都存在；指令文字', r.sprCls && r.clips >= 30 && r.noClip.length === 0 && r.cmdIds.length === 0
    && r.cmdTxt.p_launcher === 'Z' && r.cmdTxt.p_smasher === '→↓+Z' && r.cmdTxt.p_lucky === '→+Z' && r.cmdTxt.p_second === '跑攻中 X' && r.cmdTxt.p_slowheal === '→+Space' && r.cmdTxt.p_cure === '↓↓+Space'
    && r.cmdTxt.p_grab === '↓→+Z' && r.cmdTxt.p_purity === '↑→+Z' && r.cmdTxt.p_phoenix === '↑↓+Z' && r.cmdTxt.p_rapture === '↓→+C' && r.cmdTxt.p_emblem === '↓↑+Z', { clips: r.clips, noClip: r.noClip, cmd: r.cmdTxt });
  const visual = await page.evaluate(async () => {
    const want = { atk1: ['a1_1', 'a1_2'], atk2: ['a2_1', 'a2_2'], atk3: ['a3_1', 'a3_2'], dash: ['dash1', 'dash2'], jatk: ['jatk1', 'jatk2'] };
    const actual = Object.fromEntries(Object.entries(want).map(([k]) => [k, SPR_ANIMS.priest[k].map(([f]) => f)]));
    const missing = Object.values(actual).flat().filter(f => !SPR_DATA.priest.frames[f]);
    const look = lookFromEquip('priest', { weapon: { key: 'cross_1_0', wtype: 'cross', cls: 'priest' } });
    await loadBundles(['spr:priest']); const m = new SpriteModel('priest', SPR_FALLBACK, SPR_ANIMS.priest); avatarSetLook(m, look); await loadArtKey('weapon/' + look.wpn); m.av.sync();
    return { actual, missing, av: !!m.av, wpn: look.wpn, wim: !!m.av.wim, first: m.frameOf({ __c: 'atk1', __t: 0 }), second: m.frameOf({ __c: 'atk1', __t: 0.1 }) };
  });
  report('攻击帧和武器外观：普攻引用实际帧、圣职者挂外观层、十字架可见', visual.actual.atk1.join() === 'a1_1,a1_2' && visual.actual.atk2.join() === 'a2_1,a2_2'
    && visual.actual.atk3.join() === 'a3_1,a3_2' && visual.actual.dash.join() === 'dash1,dash2' && visual.actual.jatk.join() === 'jatk1,jatk2'
    && !visual.missing.length && visual.av && visual.wpn && visual.wim && visual.first === 'a1_1' && visual.second === 'a1_2', visual);
  noErr(logs, 'ids');
  await browser.close();
}

// 测试房间 + 逐帧步进的工具（base / party 共用）
async function room(page) {
  await page.goto(`${URL_BASE}?test&cls=priest&priest=1&mobs=0&mute&rawcd`); await ready(page);
  await page.evaluate(() => {
    game.paused = true;
    window.T = {
      run(n) { for (let i = 0; i < n; i++) step(1 / 60); },
      tap(a) { input.virt[a] = 2; T.run(1); delete input.virt[a]; },
      hold(a) { input.virt[a] = 1; }, release(a) { delete input.virt[a]; },
      clear() { for (const e of ents) if (e !== game.player) e.remove = true; T.run(1); projs.length = 0; if (typeof clearAllSummons === 'function') clearAllSummons('round'); },
      reset(p = game.player) { for (const k in input.virt) delete input.virt[k]; input.buf.length = 0; input.dirHist.length = 0;
        Object.assign(p, { x: 300, y: 100, z: 0, vx: 0, vy: 0, vz: 0, face: 1, act: null, invul: 0, superArmor: 0, hitstop: 0, dead: false, cool: {}, buffs: {}, charges: {}, bsCd: 0, reboundCd: 0, techHold: false, stun: 0, airAtk: 0, status: {} });
        p.hp = p.hpMax; p.mp = p.mpMax = 99999; p.mpRegen = 1e-9; p.setState('idle'); resetCmb(p); T.run(2); },
      mob(x = 370, y = 100, o = {}) { const m = spawnMonster('goblin', x, y); m.control = null; m.invul = 0; m.z = 0; m.vz = 0; m.hp = m.hpMax = 1e9; m.evade = 0; m.setState('idle'); Object.assign(m, o); return m; },
      until(f, n = 240) { for (let i = 0; i < n; i++) { if (f()) return i; T.run(1); } return -1; },
      idle(n = 400) { const p = game.player; T.until(() => p.st !== 'act' && p.z <= 0 && p.st !== 'jump' && !p.hitstop, n); T.run(2); },
    };
    const L = game.skillLv; for (const id of CLASSES.priest.skills) if (SKILLS[id]) L[id] = SKILLS[id].maxLv === 1 ? 1 : 5; L.c_bsup = 0;
    game.skillBar = ['p_launcher', 'p_smasher', 'p_lucky', 'p_second', 'p_slowheal', 'p_cure', 'p_grab', 'p_purity', 'p_phoenix', 'p_rapture', 'p_emblem', null, null, null];
    inv.equip.weapon = null; recalcStats(game.player); game.player.mp = game.player.mpMax = 99999;
  });
}

// ---------------- party ----------------
if (MODES.includes('party')) {
  const { browser, page, logs } = await launch({ width: 960, height: 540 });
  await room(page);
  const r = await page.evaluate(() => {
    const p = game.player, out = {}; T.clear(); T.reset();
    // hot：每秒回复最大 HP 的比例，按秒结算
    p.lastHurtT = 1e9; p.hp = Math.round(p.hpMax * 0.3); const h0 = p.hp; p.buffs.x_hot = { t: 5, hot: 0.02 }; T.run(60 * 3 + 2);   // lastHurtT：关掉脱战自然回复
    out.hot = +((p.hp - h0) / p.hpMax).toFixed(3); T.run(60 * 3); out.hotEnd = !p.buffs.x_hot;
    // life：致命伤害不死、回复到 30%，BUFF 用掉；第二次正常死亡
    T.reset(); const m = T.mob(340); p.buffs.x_life = { t: 30, life: 0.3, name: '生命源泉' }; p.hp = 10;
    applyHit(m, p, { dmg: 99999, sure: true }); out.life = { dead: p.dead, hp: +(p.hp / p.hpMax).toFixed(2), used: !p.buffs.x_life, invul: p.invul > 0 };
    // d.to：单体施放只给目标（partyForMe），AI 施放者自己不看 to
    T.reset(); const uid = partyMyUid();
    partyCast('buff', { id: 'x_other', to: uid + 12345, b: { t: 5, atk: 0.1 } }); out.toOther = !!p.buffs.x_other;
    partyCast('buff', { id: 'x_me', to: uid, b: { t: 5, atk: 0.1, hot: 0.01, life: 0.2 } }); out.toMe = !!(p.buffs.x_me && p.buffs.x_me.hot === 0.01 && p.buffs.x_me.life === 0.2);
    // partyPick：单刷 = 自己
    out.pick = partyPick(p, 945).t === p && partyPick(p, 945).to === uid;
    // 净化：全队解除异常
    addStatus(p, 'poison', 5, { src: m }); addStatus(p, 'slow', 5, { src: m }); partyCast('cleanse', { n: 5 }, p); out.cleanse = !p.status.poison && !p.status.slow;
    return out;
  });
  report('hot：每秒回复 2% × 3 秒 ≈ 6%，到期消失', Math.abs(r.hot - 0.06) < 0.011 && r.hotEnd, r);
  report('life：致命伤害不死、回复到 30%、用掉 BUFF、给 1 秒无敌', !r.life.dead && r.life.hp === 0.3 && r.life.used && r.life.invul, r.life);
  report('d.to：不是自己的单体 BUFF 不生效、是自己的生效（hot / life 字段能同步）；partyPick 单刷选自己；净化解除异常', !r.toOther && r.toMe && r.pick && r.cleanse, r);
  noErr(logs, 'party');
  await browser.close();
}

// ---------------- base ----------------
if (MODES.includes('base')) {
  const { browser, page, logs } = await launch({ width: 960, height: 540 });
  await room(page);
  // 1) 每个主动技能：技能栏放出来、打中面前的木桩、冷却 = 官方值（?rawcd）、MP = 官方值
  const R1 = await page.evaluate(() => {
    const p = game.player, out = {}; const skip = { p_slowheal: 'heal', p_cure: 'cure', p_rapture: 'buff' };
    for (let i = 0; i < game.skillBar.length; i++) {
      const id = game.skillBar[i]; if (!id) continue; T.clear(); T.reset();
      if (id === 'p_purity') game.job = 'crusader';
      const m = T.mob(id === 'p_emblem' ? 450 : id === 'p_grab' ? 480 : 370), S = SKILLS[id];
      const mp0 = p.mp, hp0 = m.hp; T.tap('s' + i); const cast = !!p.act && p.act.skill === id, cool = +(p.cool[id] ?? 0).toFixed(2), mp = mp0 - p.mp;
      T.run(110); out[id] = { cast, hit: m.hp < hp0, mp, cd: cool, want: [S.cd, S.mp], skip: skip[id] || null };
      T.idle(); game.job = null;
    }
    return out;
  });
  const bad1 = Object.entries(R1).filter(([, r]) => !r.cast || (!r.skip && !r.hit) || Math.abs(r.cd - r.want[0]) > 0.01 || r.mp !== r.want[1]);
  report('11 个主动技能：技能栏放得出、打得中木桩（治疗 / 净化 / 化魔除外）、冷却 = 官方值、MP = 官方值', bad1.length === 0 && Object.keys(R1).length === 11, bad1.length ? Object.fromEntries(bad1) : Object.fromEntries(Object.entries(R1).map(([k, r]) => [k, [r.cd, r.mp, r.hit]])));
  // 2) 官方指令
  const R2 = await page.evaluate(() => {
    const p = game.player, out = {}, got = () => { const s = p.act && (p.act.skill || p.act.name); T.run(1); return s; };
    const go = (name, f) => { T.clear(); T.reset(); f(); out[name] = got(); T.run(80); T.idle(); };
    go('Z', () => T.tap('cmd'));
    go('FD_Z', () => { T.tap('right'); T.tap('down'); T.tap('cmd'); });
    go('F_Z', () => { T.hold('right'); T.run(3); T.tap('cmd'); T.release('right'); });
    go('F_Space', () => { T.hold('right'); T.run(3); T.tap('cmdB'); T.release('right'); });
    go('DD_Space', () => { T.tap('down'); T.run(2); T.tap('down'); T.tap('cmdB'); });
    go('DF_Z', () => { T.tap('down'); T.tap('right'); T.tap('cmd'); });
    go('UF_Z', () => { game.job = 'crusader'; T.tap('up'); T.tap('right'); T.tap('cmd'); });
    game.job = null;
    go('UD_Z', () => { T.tap('up'); T.tap('down'); T.tap('cmd'); });
    go('DF_C', () => { T.tap('down'); T.tap('right'); T.tap('jump'); });
    go('DU_Z', () => { T.tap('down'); T.tap('up'); T.tap('cmd'); });
    go('D_C', () => { T.hold('down'); T.run(3); T.tap('jump'); T.release('down'); });
    go('run_X', () => { T.tap('right'); T.run(2); input.virt.right = 2; T.run(6); T.tap('attack'); T.release('right'); });
    return out;
  });
  const want2 = { Z: 'p_launcher', FD_Z: 'p_smasher', F_Z: 'p_lucky', F_Space: 'p_slowheal', DD_Space: 'p_cure', DF_Z: 'p_grab', UF_Z: 'p_purity', UD_Z: 'p_phoenix', DF_C: 'p_rapture', DU_Z: 'p_emblem', D_C: 'back', run_X: 'dash' };
  const bad2 = Object.entries(want2).filter(([k, v]) => R2[k] !== v);
  report('官方指令：Z 空斩打 / →↓+Z 虎袭 / →+Z 直拳冲击 / →+Space 缓慢愈合 / ↓↓+Space 净化 / ↓→+Z 恶魔之手 / ↑→+Z 纯白之刃（圣骑士）/ ↑↓+Z 落凤锤 / ↓→+C 化魔 / ↓↑+Z 升天阵；↓+C 仍是后跳', bad2.length === 0, { bad: bad2.map(([k, v]) => `${k}:${R2[k]}≠${v}`) });
  // 3) 机制
  const R3 = await page.evaluate(() => {
    const p = game.player, out = {};
    // 空斩打：身前挑空、身后砸倒，全程霸体
    T.clear(); T.reset(); let m = T.mob(360), b = T.mob(250); castSkill(p, 'p_launcher'); let sa = true;
    for (let i = 0; i < 26; i++) { T.run(1); if (p.act && p.act.skill === 'p_launcher' && !(p.superArmor > 0)) sa = false; }
    out.launcher = { frontAir: m.st === 'air' && m.z > 30, backDown: b.st === 'air' || b.st === 'down', sa }; T.idle();
    // 虎袭：抓住（霸体也能抓）、抓住期间无敌、推着冲刺撞到别的敌人、扔出去；冲刺中按 X 立即扔出；领主抓不住（只挨一下）
    T.clear(); T.reset(); m = T.mob(360, 100, { superArmor: 99 }); const o = T.mob(560, 100); const x0 = p.x, mh = m.hp, oh = o.hp; castSkill(p, 'p_smasher'); let held = false, inv = false;
    for (let i = 0; i < 100; i++) { T.run(1); if (m.st === 'held') { held = true; if (p.invul > 0) inv = true; } }
    out.smash = { held, inv, moved: Math.round(p.x - x0), dmg: m.hp < mh, other: o.hp < oh, thrown: m.st === 'air' || m.st === 'down' || m.x > 520 }; m.superArmor = 0; T.idle();
    T.clear(); T.reset(); m = T.mob(360); castSkill(p, 'p_smasher'); T.until(() => m.st === 'held', 30); const g0 = p.actT; T.run(8); input.virt.attack = 2; T.run(1); delete input.virt.attack; T.run(1);
    out.quick = { thrownAt: +((p.act ? p.act.thrown : false) && (p.actT - g0)).toFixed(2), moved: Math.round(p.x - 300) }; T.run(60); T.idle();
    T.clear(); T.reset(); const bo = T.mob(360, 100, { boss: true }); const bh = bo.hp; castSkill(p, 'p_smasher'); let bHeld = false; for (let i = 0; i < 60; i++) { T.run(1); if (bo.st === 'held') bHeld = true; }
    out.boss = { held: bHeld, dmg: bo.hp < bh }; T.idle();
    // 跑攻 → X = 勾拳追击（挑空、霸体）
    T.clear(); T.reset(); m = T.mob(420); p.doAct(p.acts.dash); const seq = [];
    for (let i = 0; i < 90; i++) { if (i === 14) input.virt.attack = 2; T.run(1); delete input.virt.attack; const n = p.act && (p.act.skill || p.act.name); if (n && seq[seq.length - 1] !== n) seq.push(n); }
    out.dashX = { seq, air: m.st === 'air' || m.z > 10 }; T.idle();
    // 直拳冲击：3 段、按住 → 前进更远、按住 ← 原地
    const lucky = dir => { T.clear(); T.reset(); const mm = T.mob(380); let n = 0; const mh2 = mm.hp; let last = mm.hp; castSkill(p, 'p_lucky'); if (dir) T.hold(dir);
      for (let i = 0; i < 54; i++) { T.run(1); if (i === 3 && dir) T.release(dir); if (mm.hp < last) { n++; last = mm.hp; } } const r = { hits: n, dx: Math.round(p.x - 300), dmg: mh2 > mm.hp }; T.idle(); return r; };
    out.lucky = { fwd: lucky('right'), back: lucky('left'), none: lucky(null) };
    // 落凤锤：跳起落地出冲击波（打到 150px 外的敌人），拔出巨兵时无敌
    T.clear(); T.reset(); m = T.mob(470); const far = T.mob(470, 160); const fh = far.hp; castSkill(p, 'p_phoenix'); let invAfter = false, landed = false, mz = 0;
    for (let i = 0; i < 120; i++) { T.run(1); mz = Math.max(mz, m.z); if (p.act && p.act.skill === 'p_phoenix' && !p.act.onLand) { landed = true; if (p.invul > 0) invAfter = true; } }
    out.phoenix = { landed, invAfter, far: far.hp < fh, launched: mz > 30, mz: Math.round(mz) }; T.idle();
    // 恶魔之手：260px 外打得到、两段、束缚几率（Lv5 36%，多试几次）
    T.clear(); T.reset(); let bound = 0, hits2 = 0; const rnd0 = Math.random; Math.random = () => 0.05;   // 束缚是几率（Lv5 36%）：固定随机数，结果确定
    for (let k = 0; k < 2; k++) { T.clear(); T.reset(); const mm = T.mob(540); let last = mm.hp, n = 0; castSkill(p, 'p_grab'); for (let i = 0; i < 60; i++) { T.run(1); if (mm.hp < last) { n++; last = mm.hp; } if (mm.status && mm.status.bind) bound++; } hits2 = Math.max(hits2, n); T.idle(); }
    Math.random = rnd0; out.grab = { hits: hits2, bound: bound > 0 };
    // 升天阵：前方 150px 的法阵挑空（圣骑士学不了）；驱魔师：普攻中能取消
    T.clear(); T.reset(); m = T.mob(450); castSkill(p, 'p_emblem'); T.run(50); out.emblem = { air: m.st === 'air' || m.z > 10, crusader: skillAllowed('p_emblem', 'crusader'), exo: skillAllowed('p_emblem', 'exorcist'), purity: [skillAllowed('p_purity', 'crusader'), skillAllowed('p_purity', 'monk')] }; T.idle();
    return out;
  });
  report('空斩打：身前挑空、身后砸倒、整个动作霸体', R3.launcher.frontAir && R3.launcher.backDown && R3.launcher.sa, R3.launcher);
  report('虎袭：抓住霸体的敌人、抓住期间无敌、推着冲刺（>150px）撞到别的敌人、扔出去；冲刺中按 X 立即扔出；领主抓不住（只挨一下）',
    R3.smash.held && R3.smash.inv && R3.smash.moved > 150 && R3.smash.dmg && R3.smash.other && R3.smash.thrown && R3.quick.thrownAt > 0 && R3.quick.thrownAt < 0.3 && !R3.boss.held && R3.boss.dmg, { smash: R3.smash, quick: R3.quick, boss: R3.boss });
  report('跑攻（滑步猛击）中按 X 接勾拳追击，把敌人挑空', R3.dashX.seq.join() === 'dash,p_second' && R3.dashX.air, R3.dashX);
  report('直拳冲击：3 段；按住 → 前进最远、按住 ← 原地', R3.lucky.fwd.hits === 3 && R3.lucky.fwd.dx > R3.lucky.none.dx && R3.lucky.none.dx > R3.lucky.back.dx && R3.lucky.back.dx < 10, R3.lucky);
  report('落凤锤：落地冲击波打到 150px 外的敌人、挑空，拔出巨兵时无敌', R3.phoenix.landed && R3.phoenix.invAfter && R3.phoenix.far && R3.phoenix.launched, R3.phoenix);
  report('恶魔之手：240px 外两段命中、几率束缚', R3.grab.hits >= 2 && R3.grab.bound, R3.grab);
  report('升天阵挑空；圣骑士学不了升天阵、只有圣骑士能学纯白之刃', R3.emblem.air && !R3.emblem.crusader && R3.emblem.exo && R3.emblem.purity[0] && !R3.emblem.purity[1], R3.emblem);
  // 4) 取消白名单：普攻 → 攻击技能随时；直拳冲击只有蓝拳、升天阵 / 落凤锤只有驱魔师；缓慢愈合（BUFF）不能取消普攻
  const R4 = await page.evaluate(() => {
    const p = game.player, out = {};
    // 不放木桩（命中停顿期间不处理输入）；按技能栏的键（castSkill 本身不看取消规则）
    const tryCancel = (id, job) => { T.clear(); T.reset(); game.job = job || null; T.tap('attack'); T.run(4); const a = p.act && p.act.name; T.tap('s' + game.skillBar.indexOf(id)); const r = { from: a, to: p.act && (p.act.skill || p.act.name) }; T.run(80); T.idle(); game.job = null; return r.from === 'atk1' && r.to === id; };
    for (const id of ['p_launcher', 'p_smasher', 'p_grab', 'p_slowheal']) out[id] = tryCancel(id);
    out.lucky = [tryCancel('p_lucky'), tryCancel('p_lucky', 'monk')];
    out.emblem = [tryCancel('p_emblem'), tryCancel('p_emblem', 'exorcist')];
    out.phoenix = [tryCancel('p_phoenix'), tryCancel('p_phoenix', 'exorcist')];
    out.purity = tryCancel('p_purity', 'crusader');
    return out;
  });
  report('取消：普攻 → 空斩打 / 虎袭 / 恶魔之手 / 纯白之刃随时；直拳冲击只有蓝拳、升天阵 / 落凤锤只有驱魔师；缓慢愈合不能取消普攻',
    R4.p_launcher && R4.p_smasher && R4.p_grab && R4.purity && !R4.p_slowheal && !R4.lucky[0] && R4.lucky[1] && !R4.emblem[0] && R4.emblem[1] && !R4.phoenix[0] && R4.phoenix[1], R4);
  // 5) 治疗 / 净化 / 化魔 / 武器手感
  const R5 = await page.evaluate(() => {
    const p = game.player, out = {};
    T.clear(); T.reset(); p.lastHurtT = 1e9; p.hp = Math.round(p.hpMax * 0.2); const h0 = p.hp; castSkill(p, 'p_slowheal'); T.run(60 * 21);
    out.heal = { gain: +((p.hp - h0) / p.hpMax).toFixed(3), want: +pHealPct(p, 5).toFixed(3), buffGone: !p.buffs.p_slowheal };
    T.clear(); T.reset(); const m = T.mob(600); addStatus(p, 'poison', 9, { src: m }); addStatus(p, 'burn', 9, { src: m }); addStatus(p, 'blind', 9, { src: m }); castSkill(p, 'p_cure'); T.run(50); out.cure = !p.status.poison && !p.status.burn && !p.status.blind; T.idle();
    T.clear(); T.reset(); p.lastHurtT = 1e9; p.mp = 100; const hp1 = p.hp; castSkill(p, 'p_rapture'); T.run(60 * 9); out.rapture = { mp: Math.round((p.mp - 100) / p.mpMax * 100) / 100, hp: +((hp1 - p.hp) / p.hpMax).toFixed(3), gone: !p.buffs.p_rapture };
    T.idle(); p.hp = Math.round(p.hpMax * 0.2); p.cool = {}; castSkill(p, 'p_rapture'); out.raptureLow = !!(p.act && p.act.skill === 'p_rapture'); T.idle();
    const reach = w => { inv.equip.weapon = w ? { key: 'x', slot: 'weapon', wtype: w, lvl: 1, rar: 0 } : null; recalcStats(p); T.run(16); return p.acts.atk1.hits[0].box[1]; };
    out.reach = { none: reach(null), cross: reach('cross'), rosary: reach('rosary'), scythe: reach('scythe'), battleaxe: reach('battleaxe') }; inv.equip.weapon = null; recalcStats(p);
    return out;
  });
  report('缓慢愈合：20 秒回复 ≈ 表里的比例（单刷给自己），到期消失', Math.abs(R5.heal.gain - R5.heal.want) < 0.03 && R5.heal.buffGone, R5.heal);
  report('净化：解除中毒 / 灼烧 / 失明', R5.cure, R5.cure);
  report('化魔：8 秒 4 次 HP -3% / MP +6%，HP 低于 25% 放不出', R5.rapture.gone && Math.abs(R5.rapture.hp - 0.12) < 0.02 && Math.abs(R5.rapture.mp - 0.24) < 0.02 && !R5.raptureLow, R5.rapture);
  report('武器手感：不装武器 = 十字架；念珠距离短、镰刀 / 战斧距离长', R5.reach.none === R5.reach.cross && R5.reach.rosary < R5.reach.cross && R5.reach.scythe > R5.reach.cross && R5.reach.battleaxe > R5.reach.cross, R5.reach);
  noErr(logs, 'base');
  await browser.close();
}

// ---------------- smoke ----------------
if (MODES.includes('smoke')) {
  const { browser, page, logs } = await launch({ width: 1280, height: 720 });
  await page.goto(`${URL_BASE}?mute&priest=1&fresh`); await ready(page);
  const made = await page.evaluate(async () => { save.newGame('priest', '圣职测试'); await startGame('priest'); save.write(); return { cls: game.player.cls, wpn: inv.equip.weapon && inv.equip.weapon.wtype, scene: game.scene, lv: game.skillLv.p_launcher || 0 }; });
  report('?priest=1 新建圣职者 → 进城，初始武器十字架、会空斩打', made.cls === 'priest' && made.wpn === 'cross' && made.lv > 0, made);
  await page.evaluate(async () => { await enterDungeon('lorien', 0); });
  await page.waitForTimeout(1500);
  const kb = page.keyboard, wait = ms => page.waitForTimeout(ms);
  await kb.down('ArrowRight'); await wait(600); await kb.up('ArrowRight');
  for (let i = 0; i < 4; i++) { await kb.press('KeyX'); await wait(160); }
  await kb.press('KeyZ'); await wait(500); await kb.press('KeyA'); await wait(700); await kb.press('KeyS'); await wait(900);
  const st = await page.evaluate(() => ({ scene: game.scene, dg: !!game.dungeon, hp: game.player.hp > 0, frameErrs: frameErrs.length }));
  fs.mkdirSync('test/shots', { recursive: true }); await page.screenshot({ path: 'test/shots/priest_smoke.png' });
  report('地下城里走动 / 普攻 / 空斩打 / 技能栏，不卡死', st.dg && st.hp && st.frameErrs === 0, st);
  noErr(logs, 'smoke');
  await browser.close();
}

console.log(fail ? `\n${fail} 项失败` : '\n全部通过');
process.exit(fail ? 1 : 0);
