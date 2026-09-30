/* =====================================================================
   91c. 决斗场（PvP 原型）：玩家 vs AI 控制的另一个职业角色（?duel=sword&vs=gun），三局两胜，每局 60 秒
   ?duel=<职业|me>&vs=<职业>&job=<转职>&vsjob=<转职>&lv=30&ai=1..3&auto（自己也交给 AI，自动测试用）&theme=<场景>
   - 天平系统：双方按职业写入一套固定的 PvP 属性（不看装备），伤害再乘决斗场修正（engine/combat.js 的 PVP）
   - 保护机制（engine/combat.js）：浮空保护、倒地保护、抓取保护；燃斗模式（HP ≤25%：攻击 +15%、受到伤害 −10%）
   - 决斗不写玩家存档（存档键切到 dawnbreak_duel）
   ===================================================================== */
const DUEL_CFG = { rounds: 1, time: 60, lv: 30 };   // 一局定胜负（用户要求，2026-09-29；原来三局两胜）   // 决斗等级固定 Lv30（2026-09-28 满级提到 60 后不变：PVP_JOB / DUEL_BASE 都是按 Lv30 技能等级调的，见 docs/PVP.md）
const DUEL_BASE = {   // 每个职业的 PvP 基准属性（天平后）
  sword: { hp: 21000, mp: 4200, atk: 2100, matk: 1800, def: 2100, mdef: 1800 },
  gun: { hp: 19500, mp: 4400, atk: 2000, matk: 1700, def: 1900, mdef: 1900 },
  mage: { hp: 18000, mp: 5600, atk: 1300, matk: 2150, def: 1700, mdef: 2200 },
  fighter: { hp: 21000, mp: 4200, atk: 2100, matk: 1800, def: 2100, mdef: 1800 },   // B0 先抄鬼剑士，B9 跑 pvp_balance 再调
};
function duelStats(p) {
  const B = DUEL_BASE[p.cls], C = CLASSES[p.cls];
  Object.assign(p, { hpMax: B.hp, hp: B.hp, mpMax: B.mp, mp: B.mp, atk: B.atk, matk: B.matk, indep: B.atk, def: B.def, mdef: B.mdef, crit: 0.12, mcrit: 0.12, baseCrit: 0.12, baseMcrit: 0.12, critDmg: 1.5,
    aspd: 1, cspd: 1, mspd: 1, hitRate: 0.05, evade: 0.03, hardness: 0, stagger: 0, elem: null, res: null, cdMul: 1, dmgUp: 0, dmgTaken: 1, atkElem: null, lvl: DUEL_CFG.lv,
    // 公正决斗：装备 / 强化 / 增幅 / 锻造 / 宝珠 / 附魔 / 套装 / 史诗特效 / 时装 / 宠物 / 称号 / 图鉴 / 公会 / 虚弱全部不带进来（这些都在 recalcStats 里，决斗角色不走它）
    gearProcs: [], sets: {}, mastery: null, masteryN: 0, killHeal: 0, killMp: 0, mpRegen: 1, weak: false, goldUp: 0, expUp: 0 });
  const J = C.jobs && p.kit && C.jobs[p.kit.job];
  const pj = PVP_JOB[p.cls + ':' + ((p.kit && p.kit.job) || '')] ?? 1;   // 职业平衡修正（docs/PVP.md，AI 循环赛调出来的）：造成伤害倍率 [, 受到伤害倍率]
  p.dmgUp = (Array.isArray(pj) ? pj[0] : pj) - 1; p.dmgTaken = Array.isArray(pj) ? pj[1] : 1;
  if (J && J.dmgType === 'mag') { p.matk = Math.max(B.matk, B.atk); p.dmgType = 'mag'; }   // 神枪手里的魔法转职（机械师）：决斗魔攻不低于同职业物理转职的物攻
  p.baseStats = { atk: B.atk, speed: C.speed * 1.1, runSpeed: C.runSpeed * 1.1 };
  applyBuffs(p);
}
const firstJob = cls => openJobs(cls)[0] || null;   // 没开放的转职（J.ready === false）不选
/* ---- 公正决斗（排位 / 练习 / 好友决斗都一样，地下城不受影响）：规则见 docs/PVP.md ----
   技能等级：决斗等级（30）下本职业 + 转职能学的技能全部按标准等级 1 + ⌊(30 − 需求等级) / 3⌋（不超过满级），和 SP 加点、装备的技能等级无关；
   觉醒（一 / 二 / 三觉）在决斗里全部可用，不看觉醒任务；每局最多放一次（冷却至少 61 秒，每局开始冷却清零）。技能栏沿用玩家自己的摆放（只保留能用的技能） */
function duelKit(cls, job, bar) {
  const K = aiKit(cls, job, DUEL_CFG.lv);
  if (Array.isArray(bar) && bar.some(Boolean)) K.bar = Array.from({ length: SKILL_SLOTS }, (_, i) => { const id = bar[i]; return id && K.lv[id] > 0 && SKILLS[id] && !SKILLS[id].passive ? id : null; });
  const J = CLASSES[cls].jobs && CLASSES[cls].jobs[job];
  if (J && J.auto) for (const id of J.auto) if (!(K.lv[id] > 0)) K.lv[id] = 1;
  return K;
}
// 决斗里对照用的“公正属性”快照（测试 / 联机两端核对）
function duelFairSnap(p) {
  const r = v => Math.round(v * 1000) / 1000;
  return { cls: p.cls, job: (p.kit && p.kit.job) || null, lvl: p.lvl, hpMax: p.hpMax, mpMax: p.mpMax, atk: r(p.baseStats ? p.baseStats.atk : p.atk), matk: r(p.matk), indep: r(p.indep), def: r(p.def), mdef: r(p.mdef),
    crit: r(p.baseCrit), critDmg: p.critDmg, aspd: p.aspd, cspd: p.cspd, mspd: p.mspd, cdMul: p.cdMul, dmgUp: r(p.dmgUp), dmgTaken: p.dmgTaken, hitRate: p.hitRate, evade: p.evade,
    skills: Object.keys((p.kit && p.kit.lv) || {}).sort().map(k => k + ':' + p.kit.lv[k]).join(','), procs: (p.gearProcs || []).length, sets: Object.keys(p.sets || {}).length };
}
// 决斗中别的系统（换装 / 公会 / 任务 / 装备损坏）想重算属性：决斗角色一律忽略
{ const rs0 = recalcStats; recalcStats = function (p) { if (p && p.fighter && game.pvp && game.duel && p.kit) return; return rs0(p); }; }
// 决斗里所有觉醒都能放（不看觉醒任务）
{ const tu0 = tierUnlocked; tierUnlocked = function (n) { return game.pvp && game.duel ? true : tu0(n); }; }
/* ---- 决斗场伤害修正（全局 PVP.dmg 之外，按技能类型的默认系数；职业文件里写了 S.pvp 的以职业为准）---- */
const PVP_SKILL = { awaken: 0.5, grab: 0.8, summon: 0.8, burst: 0.85, aoe: 0.9 };
// 职业（转职）整体修正：AI 循环赛（node test/pvp_balance.mjs 6 all 6）自动调出来的，1 = 不修正；数组 = [造成伤害, 受到伤害]（未转职技能太少，只加伤害追不上）
const PVP_JOB = {
  'sword:': [1.95, 0.55], 'sword:blade': 0.66, 'sword:berserker': 0.76, 'sword:asura': [0.34, 1.15], 'sword:soulbender': 0.72, 'sword:ghostblade': 0.64,
  'gun:': [2.8, 0.65], 'gun:ranger': 1.16, 'gun:launcher': 1.15, 'gun:spitfire': 0.58, 'gun:mechanic': 0.62, 'gun:paramedic': 1.2,
  'mage:': 2.0, 'mage:elemental': 0.76, 'mage:battlemage': 0.88, 'mage:summoner': 0.56, 'mage:witch': 0.48, 'mage:enchantress': 0.78,
};
for (const id in SKILLS) {
  const S = SKILLS[id]; if (!S || S.passive) continue;
  const kind = S.awaken ? 'awaken' : S.ai && S.ai.summon ? 'summon' : S.ai && S.ai.kind;
  if (S.pvp === undefined && PVP_SKILL[kind]) S.pvp = PVP_SKILL[kind];
  if (S.awaken && S.cd && S.cd * (S.pvpCd || 1) < 61) S.pvpCd = 61 / S.cd;   // 觉醒每局一次
}
const duel = {
  state: 'none', t: 0, round: 1, wins: [0, 0], a: null, b: null, msg: '', msgT: 0, timer: 60, koT: 0, result: null,
  start(o) {
    this.o = o; this.round = 1; this.wins = [0, 0]; this.result = null;
    ents.length = 0; projs.length = 0; fxList.length = 0; drops.length = 0; groundFx.length = 0; numList.length = 0;
    game.scene = 'test'; game.pvp = true; game.duel = this; game.dungeon = null; game.lvl = o.lv;
    game.room = { x0: 0, x1: 1120, theme: o.theme, seed: 11 }; buildRoomArt(game.room);
    // 玩家一方：技能栏 / 等级写进 game（HUD 用），角色用同一份 kit
    const kA = duelKit(o.a, o.ja, o.me && o.me.skillBar);   // 我的角色：标准技能等级 + 自己的技能栏
    game.job = o.ja; game.skillLv = kA.lv; game.skillBar = kA.bar;
    const a = makePlayer(o.a, { kit: { bar: game.skillBar, lv: game.skillLv, job: o.ja, wtype: null }, name: o.nameA || CLASSES[o.a].name });
    if (o.auto) { a.pad = new Pad(); a.brain = new FighterBrain(a, o.ai); }
    const b = makePlayer(o.b, { team: 'e', pad: new Pad(), kit: duelKit(o.b, o.jb), name: o.nameB || 'AI · ' + CLASSES[o.b].name });
    b.brain = new FighterBrain(b, o.ai);
    for (const p of [a, b]) { duelStats(p); const inner = p.brain ? aiFighterControl : playerControl; p.control = (e, dt) => { if (duel.state === 'fight') inner(e, dt); else if (e.pad !== input) { e.pad.frame(game.t); } }; }
    game.player = a; this.a = a; this.b = b; ents.push(a, b);
    cmdLabel(o.a); music.play('boss');
    this.resetRound();
  },
  resetRound() {
    projs.length = 0; groundFx.length = 0; game.timeStop = 0; game.cutin = null; game.slowmo = false;
    [[this.a, 330, 1], [this.b, 790, -1]].forEach(([p, x, f]) => {
      Object.assign(p, { x, y: DEPTH / 2, z: 0, vx: 0, vy: 0, vz: 0, face: f, dead: false, hp: p.hpMax, mp: p.mpMax, invul: 0, superArmor: 0, stun: 0, hitstop: 0, act: null, status: {}, buffs: {}, cool: {}, chasers: [], rot: 0, reboundCd: 0, bsCd: 0, charges: {}, burning: false });
      if (p.brain) p.brain.reset();
      p.grabbed = null; p.heldBy = null; p.deadT = 0; p.remove = false; if (!ents.includes(p)) ents.push(p); p.setState('idle'); p.play('idle', true); resetCmb(p); applyBuffs(p);
    });
    this.state = 'intro'; this.t = 0; this.timer = DUEL_CFG.time; this.say(`ROUND ${this.round}`, 1.1);
  },
  say(msg, dur = 1) { this.msg = msg; this.msgT = dur; this.msgDur = dur; },
  focusX() { return (this.a.x + this.b.x) / 2; },
  update(dt) {
    this.t += dt; if (this.msgT > 0) this.msgT -= dt;
    const A = this.a, B = this.b;
    if (this.state === 'intro') { if (this.t > 1.1 && !this.fightSaid) { this.fightSaid = true; this.say('FIGHT!', 0.7); sfx.boom(0.5); } if (this.t > 1.6) { this.state = 'fight'; this.fightSaid = false; } return; }
    if (this.state === 'fight') {
      this.timer -= dt;
      for (const p of [A, B]) if (!p.burning && !p.dead && p.hp < p.hpMax * 0.25) { p.burning = true; p.buffs.burn_mode = { t: 999, atk: 0.15, taken: -0.1 }; fxText('燃斗模式', p.x, p.y, p.z + 20, { col: '#ff7a3a', size: 14, dur: 1.2 }); fxAura(p, '#ff6a2a', 1); }
      if (A.dead || B.dead || this.timer <= 0) this.ko(A.dead && B.dead ? -1 : A.dead ? 1 : B.dead ? 0 : (Math.abs(A.hp / A.hpMax - B.hp / B.hpMax) < 1e-6 ? -1 : A.hp / A.hpMax > B.hp / B.hpMax ? 0 : 1));   // 时间到：剩余 HP 比例高的赢，一样就平局
      return;
    }
    if (this.state === 'ko') {
      this.koT += dt; if (this.koT > 0.9) game.slowmo = false;
      const last = Math.max(this.wins[0], this.wins[1]) > DUEL_CFG.rounds / 2 || this.round >= DUEL_CFG.rounds;
      if (this.koT > (last ? 1.2 : 2.6)) { if (last) this.finish(); else { this.round++; this.resetRound(); } }   // 最后一局 K.O. 后 1.2 秒直接出结果
      return;
    }
    if (this.state === 'result') { if (input.hit('attack') || input.hit('confirm') || this.o.auto && this.t > 3) { if (this.o.auto) { window.__duelDone = this.result; this.state = 'done'; return; } this.start(this.o); } }
  },
  ko(winner) {
    this.state = 'ko'; this.koT = 0; game.slowmo = true;
    if (winner >= 0) this.wins[winner]++;
    this.lastWinner = winner;
    this.say(this.timer <= 0 ? 'TIME UP' : winner < 0 ? 'DOUBLE K.O.' : 'K.O.', 1.6); cam.shake = 10; sfx.boom(1.2);
    (this.roundLog = this.roundLog || []).push({ round: this.round, winner, hpA: Math.round(this.a.hp / this.a.hpMax * 100), hpB: Math.round(this.b.hp / this.b.hpMax * 100), time: Math.round(DUEL_CFG.time - this.timer) });
  },
  finish() {
    this.state = 'result'; this.t = 0; game.slowmo = false;
    const w = this.wins[0] > this.wins[1] ? 0 : this.wins[1] > this.wins[0] ? 1 : -1;
    this.result = { winner: w, wins: this.wins.slice(), rounds: this.roundLog.slice(), a: this.o.a + ':' + (this.o.ja || ''), b: this.o.b + ':' + (this.o.jb || '') };
    this.say(w === 0 ? 'YOU WIN' : w === 1 ? 'YOU LOSE' : 'DRAW', 99);
  },
  onKill(t, a) { if (t.fighter) { t.hp = 0; } },
  // ---- 画面：双方血条 / MP / 保护条 / 回合 / 计时 / 中央提示 ----
  drawOverlay(c) {
    const A = this.a, B = this.b;
    const bar = (p, x, w, right) => {
      const f = clamp(p.hp / p.hpMax, 0, 1), y = 14, h = 16;
      c.fillStyle = 'rgba(10,6,8,.75)'; c.fillRect(x - 3, y - 3, w + 6, h + 26);
      c.fillStyle = '#3a0a0a'; c.fillRect(x, y, w, h);
      p._hpShow = p._hpShow === undefined ? f : Math.max(f, p._hpShow - 0.004);
      c.fillStyle = '#ffd070'; c.fillRect(right ? x + w * (1 - p._hpShow) : x, y, w * p._hpShow, h);
      const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, p.burning ? '#ff9a3a' : '#ff5a5a'); g.addColorStop(1, p.burning ? '#c83a0a' : '#b0101a');
      c.fillStyle = g; c.fillRect(right ? x + w * (1 - f) : x, y, w * f, h);
      c.strokeStyle = '#e8c070'; c.lineWidth = 1.5; c.strokeRect(x, y, w, h);
      // MP 与保护条（蓝 = 浮空、黄 = 倒地）
      const mp = clamp(p.mp / p.mpMax, 0, 1); c.fillStyle = '#1a3a8a'; c.fillRect(x, y + h + 2, w, 3); c.fillStyle = '#5ab0ff'; c.fillRect(right ? x + w * (1 - mp) : x, y + h + 2, w * mp, 3);
      const ap = clamp(p.cmb.airDmg / (p.hpMax * PVP.airProt), 0, 1), dp = clamp(p.cmb.downDmg / (p.hpMax * PVP.downProt), 0, 1);
      c.fillStyle = '#2a4a8a'; c.fillRect(right ? x + w - 80 : x, y + h + 7, 80 * ap, 3); c.fillStyle = '#c8a02a'; c.fillRect(right ? x + w - 80 : x, y + h + 11, 80 * dp, 3);
      const J = jobOf(p) && CLASSES[p.cls].jobs[jobOf(p)];
      c.font = 'bold 11px "PingFang SC","Microsoft YaHei",sans-serif'; c.textAlign = right ? 'right' : 'left'; c.fillStyle = '#fff';
      c.fillText(`${p.name}${J ? ' · ' + J.name : ''}  ${Math.max(0, Math.round(p.hp))}`, right ? x + w : x, y + h + 24);
      // 受身蹲伏：蹲伏中 / 冷却（双方都显示）
      const rc = p.reboundCd || 0; c.font = 'bold 10px "PingFang SC","Microsoft YaHei",sans-serif';
      c.fillStyle = p.techHold ? '#8fd8ff' : rc > 0 ? 'rgba(255,255,255,.45)' : '#9fe8b0';
      c.fillText(p.techHold ? '受身蹲伏中（无敌）' : rc > 0 ? `受身蹲伏 ${Math.ceil(rc)}s` : '受身蹲伏 就绪', right ? x + w : x, y + h + 37);
    };
    bar(A, 20, 380, false); bar(B, WW - 400, 380, true);
    c.textAlign = 'center'; c.font = '900 26px "Arial Black",sans-serif'; c.lineWidth = 4; c.strokeStyle = '#1a0806';
    const tm = Math.max(0, Math.ceil(this.timer)); c.strokeText(tm, WW / 2, 38); c.fillStyle = tm <= 10 ? '#ff6a4a' : '#ffe8a8'; c.fillText(tm, WW / 2, 38);
    for (let i = 0; i < 2; i++) for (const [k, cx] of [[0, WW / 2 - 40 - i * 14], [1, WW / 2 + 40 + i * 14]]) { c.fillStyle = this.wins[k] > i ? '#ffd23a' : 'rgba(255,255,255,.25)'; c.beginPath(); c.arc(cx, 52, 5, 0, TAU); c.fill(); }
    if (this.msgT > 0 || this.state === 'result') {
      const k = this.state === 'result' ? 1 : clamp(this.msgT / this.msgDur, 0, 1), pop = 1 + Math.max(0, k - 0.8) * 2;
      c.save(); c.globalAlpha = Math.min(1, k * 4); c.font = `italic 900 ${Math.round(56 * pop)}px "Arial Black",sans-serif`; c.lineWidth = 8; c.strokeStyle = '#1a0806';
      c.strokeText(this.msg, WW / 2, 230); const g = c.createLinearGradient(0, 190, 0, 240); g.addColorStop(0, '#fff6c0'); g.addColorStop(1, '#ff9a2a'); c.fillStyle = g; c.fillText(this.msg, WW / 2, 230);
      if (this.state === 'result') { c.font = 'bold 16px "PingFang SC",sans-serif'; c.lineWidth = 4; const s = `${this.wins[0]} : ${this.wins[1]}　按 ${keyName('attack')} 再来一局 · Esc 离开决斗场`; c.strokeText(s, WW / 2, 268); c.fillStyle = '#fff'; c.fillText(s, WW / 2, 268); }
      c.restore();
    }
  },
};
// 启动参数：?duel=sword&vs=gun（boot.js 调用）
function duelParams() {
  const pick1 = (v, def) => CLASSES[v] ? v : def;
  let a = PARAMS.get('duel'), me = null;
  if (a === 'me') { const k0 = save.key; save.key = 'dawnbreak_save_v1'; try { if (save.load()) me = JSON.parse(JSON.stringify(save.data)); } catch (e) { /* 没有存档 */ } save.key = k0; a = me ? me.cls : 'sword'; }   // 只读正式存档，不写回
  a = pick1(a, 'sword'); const b = pick1(PARAMS.get('vs'), pick(openClasses()));   // 随机对手：已开放的职业（ready:false 的不抽）
  const jobOk = (cls, j) => j === 'none' ? null : CLASSES[cls].jobs && CLASSES[cls].jobs[j] ? j : firstJob(cls);
  return { a, b, ja: me && me.job ? me.job : jobOk(a, PARAMS.get('job')), jb: jobOk(b, PARAMS.get('vsjob')), lv: +(PARAMS.get('lv') || DUEL_CFG.lv), ai: clamp(+(PARAMS.get('ai') || 2), 1, 3),
    auto: PARAMS.has('auto'), theme: PARAMS.get('theme') || 'ruinsDark', nameA: me && me.name, me };
}
function bootDuel() {
  save.key = 'dawnbreak_duel'; const o = duelParams();
  save.key = 'dawnbreak_duel'; save.chars = []; save.cur = -1; save.data = save.defaults(o.a);   // 决斗不碰正式存档（存档键切到 dawnbreak_duel）
  return withLoading(['spr:' + o.a, 'spr:' + o.b, 'bg:' + o.theme], () => duel.start(o));
}
/* ---- 决斗场入口：城镇 NPC 维尔·克鲁（竞技大赛）/ P 键窗口 ---- */
if (typeof NPC_SERVICES !== 'undefined') NPC_SERVICES.arena = { label: '决斗场', run: () => menus.open('duel') };
Object.assign(menus, {
  w_duel() {
    const sel = { a: 'me', ja: '', b: 'gun', jb: '', ai: 2 };
    const clsBtns = (key, jkey, withMe) => { const row = h('div', { class: 'duelrow' }); const draw = () => { row.replaceChildren(...[...(withMe ? ['me'] : []), ...openClasses()].map(c => h('button', { class: 'btn' + (sel[key] === c ? '' : ' off'), onclick: () => { sel[key] = c; sel[jkey] = ''; draw(); jobRow(); } }, c === 'me' ? '我的角色' : CLASSES[c].name))); }; draw(); return row; };
    const jobsA = h('div', { class: 'duelrow' }), jobsB = h('div', { class: 'duelrow' });
    const jobRow = () => { for (const [key, jkey, el] of [['a', 'ja', jobsA], ['b', 'jb', jobsB]]) { const c = sel[key]; el.replaceChildren(...(c === 'me' ? [] : Object.entries(CLASSES[c].jobs || {}).filter(([, J]) => jobOpen(J)).map(([j, J]) => h('button', { class: 'btn' + (sel[jkey] === j || (!sel[jkey] && j === firstJob(c)) ? '' : ' off'), onclick: () => { sel[jkey] = j; jobRow(); } }, J.name)))); } };
    jobRow();
    const lvRow = h('div', { class: 'duelrow' }, ...[1, 2, 3].map(n => h('button', { class: 'btn' + (sel.ai === n ? '' : ' off'), onclick: e => { sel.ai = n; [...lvRow.children].forEach((b, i) => b.classList.toggle('off', i + 1 !== n)); } }, ['简单', '普通', '困难'][n - 1])));
    const go = h('button', { class: 'btn big', onclick: () => { const q = new URLSearchParams({ duel: sel.a, vs: sel.b, ai: sel.ai }); if (DEV_OPEN) q.set('fighter', '1'); if (sel.ja) q.set('job', sel.ja); if (sel.jb) q.set('vsjob', sel.jb); if (save.data) save.write(); location.search = '?' + q.toString(); } }, '开始决斗');
    return this.win('决斗场', h('div', { class: 'duelwin' }, h('b', {}, '我方'), clsBtns('a', 'ja', true), jobsA, h('b', {}, '对手（AI）'), clsBtns('b', 'jb', false), jobsB, h('b', {}, 'AI 难度'), lvRow,
      h('div', { class: 'dueltip' }, '三局两胜，每局 60 秒。双方属性由天平系统统一；浮空 / 倒地保护与燃斗模式生效。'), go), { w: 34 });
  },
});
addStyle('.duelwin{display:flex;flex-direction:column;gap:.5em}.duelrow{display:flex;gap:.4em;flex-wrap:wrap}.dueltip{opacity:.75;font-size:.85em}');
