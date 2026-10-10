/* =====================================================================
   团本精英原语（docs/RAID_FRAMEWORK.md §精英）：精英 = 一个「破防条件」+ 一组专属技能，不再靠加血。
   - RAID_ELITE（纯逻辑，没有任何游戏全局，test/raid_elite.mjs 在 node:vm 里直接验）：
       6 种破防条件 TYPES：elemBall 属性球 / intercept 拦截球 / killClone 击杀分身 / breakShell 破龟壳（发电机）/ eyeGuard 睁眼禁攻 / counterBreak 破招
       create(spec) → E；tick(E, dt) → effects；on(E, ev) → effects；mul(E) 受到伤害倍率；view(E) 给 HUD；done(E) 精英倒下时上报的 raid 事件
       effects = [{ k: 'spawn', what, i, … } | { k: 'expire', what, i } | { k: 'heal', pct } | { k: 'break', dur, mul } | { k: 'unbreak' } | { k: 'punish', id, frac }
                  | { k: 'cast', dur, text } | { k: 'warn', text } | { k: 'interrupt' } | { k: 'reflect', on }]
   - 精英登记表 RAID_ELITES + defineRaidElite(id, spec)：数据驱动。spec = { name, mon: 怪物 id, type: 破防类型, p: { 覆盖该类型的默认参数 }, skills?: [怪物技能库的 skill 条目…],
       hp?: 倍率, atk?: 倍率, text?: 文案 }；
   - 运行时 raidEliteAttach(m, spec, ctx)：dungeon.js 刷 room.type === 'elite' 的精英后调它（房间 spec 里写 eliteSpec: '<登记 id>' 或内联对象）。
     只在主机（单人就是自己）跑：精英身上挂倍率 / 刷属性球·分身·龟壳（用 raid_mech_rt 的 rmObj_* 物件）/ 回血 / 惩罚；倒下时上报 raidNet.eliteKill(id)，
     规则核心按节点的 elites[id].fx 执行全局效果（开关节点 unlock / 全团增益 gbuff / 倒计时 countdown / 钥匙 key / 理智 / 混沌，见 raid_core.js 头部）
   ===================================================================== */
const RAID_ELITE = (() => {
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const ELEMS = ['fire', 'ice', 'light', 'dark'];
  const ELEM_COL = { fire: '#ff7a4a', ice: '#7ad0ff', light: '#fff0a0', dark: '#a070d0' };
  // 每种破防条件：defaults 参数、init / tick / on。状态 E 里公用字段：t 总时间、weak 虚弱剩余秒（>0 = 破防中）、objs 当前场上的物件 [{ what, i, t, ... }]
  const TYPES = {
    // 属性球：精英周期性吐出 ballN 个属性球（颜色 = 元素）。每 need 个被打碎 = 精英吸收失败而破防（weakDur 秒、受伤 weakMul）；
    // 没打碎的球 life 秒后被精英吸收：回血 healPct（吞噬魔）。平时护盾 shieldMul
    elemBall: { name: '属性球', defaults: { shieldMul: 0.15, weakMul: 1.6, weakDur: 8, every: 7, ballN: 2, life: 9, need: 2, healPct: 0.04, elems: ELEMS },
      init(E) { E.seq = 0; E.fed = 0; E.next = E.p.every; },
      tick(E, dt, out) {
        if (E.weak <= 0) { E.next -= dt; if (E.next <= 0) { E.next = E.p.every; for (let k = 0; k < E.p.ballN; k++) { const i = ++E.seq, el = E.p.elems[(i - 1) % E.p.elems.length]; E.objs.push({ what: 'ball', i, elem: el, left: E.p.life }); out.push({ k: 'spawn', what: 'ball', i, elem: el, col: ELEM_COL[el] || '#fff', life: E.p.life }); } out.push({ k: 'warn', text: '属性球！打碎它们，否则精英会吸收回血' }); } }
        for (const o of E.objs.slice()) { o.left -= dt; if (o.left <= 0) { E.objs.splice(E.objs.indexOf(o), 1); out.push({ k: 'expire', what: 'ball', i: o.i }, { k: 'heal', pct: E.p.healPct }); E.fed = Math.max(0, E.fed - 1); } }
      },
      on(E, ev, out) {
        if (ev.k !== 'ball') return; const o = E.objs.find(x => x.what === 'ball' && x.i === ev.i); if (!o) return;
        E.objs.splice(E.objs.indexOf(o), 1); E.fed++; out.push({ k: 'expire', what: 'ball', i: o.i, hit: true });
        if (E.fed >= E.p.need) { E.fed = 0; for (const x of E.objs.splice(0)) out.push({ k: 'expire', what: x.what, i: x.i }); breakNow(E, out); }
      } },
    // 拦截球：精英每 every 秒放出 orbN 个电球 / 加血球飞向自己，travel 秒后到达回血 healPct。打掉电球 = 拦截；
    // 连续拦截 need 个（中间没漏）= 破防；漏球会清零连续数
    intercept: { name: '拦截球', defaults: { shieldMul: 0.4, weakMul: 1.7, weakDur: 7, every: 8, orbN: 2, travel: 6, need: 4, healPct: 0.06 },
      init(E) { E.seq = 0; E.streak = 0; E.next = E.p.every; },
      tick(E, dt, out) {
        if (E.weak <= 0) { E.next -= dt; if (E.next <= 0) { E.next = E.p.every; for (let k = 0; k < E.p.orbN; k++) { const i = ++E.seq; E.objs.push({ what: 'orb', i, left: E.p.travel }); out.push({ k: 'spawn', what: 'orb', i, travel: E.p.travel }); } out.push({ k: 'warn', text: '电球飞向精英！拦截它们' }); } }
        for (const o of E.objs.slice()) { o.left -= dt; if (o.left <= 0) { E.objs.splice(E.objs.indexOf(o), 1); E.streak = 0; out.push({ k: 'expire', what: 'orb', i: o.i }, { k: 'heal', pct: E.p.healPct }, { k: 'warn', text: '漏球了：精英回血' }); } }
      },
      on(E, ev, out) {
        if (ev.k !== 'intercept') return; const o = E.objs.find(x => x.what === 'orb' && x.i === ev.i); if (!o) return;
        E.objs.splice(E.objs.indexOf(o), 1); E.streak++; out.push({ k: 'expire', what: 'orb', i: o.i, hit: true });
        if (E.streak >= E.p.need) { E.streak = 0; for (const x of E.objs.splice(0)) out.push({ k: 'expire', what: x.what, i: x.i }); breakNow(E, out); }
      } },
    // 击杀分身：每 every 秒开始读条 cast 秒，同时刷出 cloneN 个玩家分身；读条结束前全部杀完 = 打断并破防，没杀完 = 惩罚 punish（按最大 HP 的 frac）
    killClone: { name: '击杀分身', defaults: { shieldMul: 0.5, weakMul: 1.6, weakDur: 7, every: 14, cast: 9, cloneN: 2, punish: 0.45 },
      init(E) { E.seq = 0; E.next = E.p.every; E.cast = 0; },
      tick(E, dt, out) {
        if (E.cast > 0) {
          E.cast -= dt;
          if (E.cast <= 0) { for (const x of E.objs.splice(0)) out.push({ k: 'expire', what: x.what, i: x.i }); out.push({ k: 'punish', id: 'cloneCast', frac: E.p.punish }); E.next = E.p.every; }
        } else if (E.weak <= 0) {
          E.next -= dt;
          if (E.next <= 0) { E.cast = E.p.cast; out.push({ k: 'cast', dur: E.p.cast, text: '读条中：杀掉全部分身打断它！' }); for (let k = 0; k < E.p.cloneN; k++) { const i = ++E.seq; E.objs.push({ what: 'clone', i }); out.push({ k: 'spawn', what: 'clone', i }); } }
        }
      },
      on(E, ev, out) {
        if (ev.k !== 'cloneDead') return; const o = E.objs.find(x => x.what === 'clone' && x.i === ev.i); if (!o) return;
        E.objs.splice(E.objs.indexOf(o), 1); out.push({ k: 'expire', what: 'clone', i: o.i, hit: true });
        if (!E.objs.length && E.cast > 0) { E.cast = 0; E.next = E.p.every; out.push({ k: 'interrupt' }); breakNow(E, out); }
      } },
    // 破龟壳 / 发电机：精英身边 shells 个龟壳，壳在时只吃 shieldMul；每个壳要 hits 下才碎。全碎 = 破防 weakDur 秒；regen 秒后壳重新长出来
    breakShell: { name: '破壳', defaults: { shieldMul: 0.08, weakMul: 1.8, weakDur: 10, shells: 2, hits: 4, regen: 20 },
      init(E, out) { E.seq = 0; E.regen = 0; spawnShells(E, out); },
      tick(E, dt, out) { if (E.weak <= 0 && !E.objs.length && E.regen > 0) { E.regen -= dt; if (E.regen <= 0) { spawnShells(E, out); out.push({ k: 'warn', text: '龟壳重新长出来了' }); } } },
      on(E, ev, out) {
        if (ev.k !== 'shellBroken') return; const o = E.objs.find(x => x.what === 'shell' && x.i === ev.i); if (!o) return;
        E.objs.splice(E.objs.indexOf(o), 1); out.push({ k: 'expire', what: 'shell', i: o.i, hit: true });
        if (!E.objs.length) { E.regen = E.p.regen; breakNow(E, out); }
      } },
    // 睁眼禁攻：closed 秒后头顶的眼睛睁开并刷 cloneN 个分身，睁眼期间攻击精英 = 反射（punish frac，ev.k 'hitEye'）；杀光分身眼睛闭上并破防；open 秒内没杀光 = 全团受 punish
    eyeGuard: { name: '睁眼禁攻', defaults: { shieldMul: 1, weakMul: 1.7, weakDur: 7, closed: 12, open: 12, cloneN: 2, reflect: 0.12, punish: 0.4 },
      init(E) { E.seq = 0; E.eye = 0; E.next = E.p.closed; },
      tick(E, dt, out) {
        if (E.eye > 0) { E.eye -= dt; if (E.eye <= 0) { closeEye(E, out); for (const x of E.objs.splice(0)) out.push({ k: 'expire', what: x.what, i: x.i }); out.push({ k: 'punish', id: 'eyeOpen', frac: E.p.punish }); } }
        else if (E.weak <= 0) { E.next -= dt; if (E.next <= 0) { E.eye = E.p.open; out.push({ k: 'reflect', on: true }, { k: 'warn', text: '眼睛睁开了！别攻击精英，先杀分身' }); for (let k = 0; k < E.p.cloneN; k++) { const i = ++E.seq; E.objs.push({ what: 'clone', i }); out.push({ k: 'spawn', what: 'clone', i }); } } }
      },
      on(E, ev, out) {
        if (ev.k === 'hitEye') { if (E.eye > 0) out.push({ k: 'punish', id: 'eyeReflect', frac: E.p.reflect, who: ev.who || 'me' }); return; }
        if (ev.k !== 'cloneDead') return; const o = E.objs.find(x => x.what === 'clone' && x.i === ev.i); if (!o) return;
        E.objs.splice(E.objs.indexOf(o), 1); out.push({ k: 'expire', what: 'clone', i: o.i, hit: true });
        if (!E.objs.length && E.eye > 0) { E.eye = 0; closeEye(E, out); breakNow(E, out); }
      } },
    // 破招：每 every 秒起手 windup 秒，其中 [flashAt, flashAt + flashLen] 是闪光窗口，窗口内命中精英（ev.k 'hit'）= 打断并破防（stunDur）；没打断 = 招式落下 punish
    counterBreak: { name: '破招', defaults: { shieldMul: 0.3, weakMul: 1.6, weakDur: 6, every: 9, windup: 2.4, flashAt: 1.4, flashLen: 0.7, punish: 0.3 },
      init(E) { E.next = E.p.every; E.wind = 0; E.wt = 0; },
      tick(E, dt, out) {
        if (E.wind) {
          E.wt += dt;
          if (E.wt >= E.p.windup) { E.wind = 0; E.next = E.p.every; out.push({ k: 'punish', id: 'smash', frac: E.p.punish }); }
        } else if (E.weak <= 0) { E.next -= dt; if (E.next <= 0) { E.wind = 1; E.wt = 0; out.push({ k: 'cast', dur: E.p.windup, text: '起手！看到闪光时命中它' }); } }
      },
      on(E, ev, out) {
        if (ev.k !== 'hit' || !E.wind) return;
        if (E.wt >= E.p.flashAt && E.wt <= E.p.flashAt + E.p.flashLen) { E.wind = 0; E.next = E.p.every; out.push({ k: 'interrupt' }); breakNow(E, out); }
      } },
  };
  function spawnShells(E, out) { for (let k = 0; k < E.p.shells; k++) { const i = ++E.seq; E.objs.push({ what: 'shell', i, hits: E.p.hits }); out.push({ k: 'spawn', what: 'shell', i, hits: E.p.hits }); } }
  function closeEye(E, out) { out.push({ k: 'reflect', on: false }); E.next = E.p.closed; }
  function breakNow(E, out) { E.weak = E.p.weakDur; E.breaks++; out.push({ k: 'break', dur: E.p.weakDur, mul: E.p.weakMul }); }

  function create(spec) {
    const T = TYPES[spec && spec.type]; if (!T) throw new Error('没有这种精英破防条件：' + (spec && spec.type));
    const E = { id: String(spec.id || spec.type), type: spec.type, p: Object.assign({}, T.defaults, spec.p || {}), t: 0, weak: 0, objs: [], breaks: 0, dead: false };
    E.out0 = []; T.init(E, E.out0);
    return E;
  }
  // 推进 dt 秒；第一次调用会带出 init 时刷出来的物件（龟壳）
  function tick(E, dt) {
    const out = E.out0 || []; E.out0 = null;
    if (E.dead) return out;
    E.t += dt;
    if (E.weak > 0) { E.weak -= dt; if (E.weak <= 0) { E.weak = 0; out.push({ k: 'unbreak' }); } }
    TYPES[E.type].tick(E, dt, out);
    return out;
  }
  function on(E, ev) { const out = []; if (!E.dead) TYPES[E.type].on(E, ev || {}, out); return out; }
  // 精英受到的伤害倍率：破防中 weakMul，否则护盾 shieldMul
  const mul = E => E.dead ? 1 : E.weak > 0 ? E.p.weakMul : E.p.shieldMul;
  // 给 HUD：{ name, bar: { k, col, label } | null, weak, objs }
  function view(E) {
    const T = TYPES[E.type];
    if (E.weak > 0) return { name: T.name, weak: true, bar: { k: E.weak / E.p.weakDur, col: '#7aff9a', label: `破防！受到伤害 ×${E.p.weakMul}` }, objs: E.objs.length };
    let bar = null;
    if (E.type === 'killClone' && E.cast > 0) bar = { k: E.cast / E.p.cast, col: '#ff7a5a', label: '分身读条' };
    else if (E.type === 'eyeGuard' && E.eye > 0) bar = { k: E.eye / E.p.open, col: '#ff4a6a', label: '睁眼：禁止攻击' };
    else if (E.type === 'counterBreak' && E.wind) bar = { k: E.wt / E.p.windup, col: E.wt >= E.p.flashAt && E.wt <= E.p.flashAt + E.p.flashLen ? '#fff6a0' : '#ff9a5a', label: E.wt >= E.p.flashAt && E.wt <= E.p.flashAt + E.p.flashLen ? '闪光！命中它' : '起手' };
    else if (E.type === 'elemBall') bar = { k: Math.min(1, E.fed / E.p.need), col: '#7ad0ff', label: `打碎属性球 ${E.fed}/${E.p.need}` };
    else if (E.type === 'intercept') bar = { k: Math.min(1, E.streak / E.p.need), col: '#7affd0', label: `连续拦截 ${E.streak}/${E.p.need}` };
    else if (E.type === 'breakShell') bar = { k: E.objs.length ? E.objs.length / E.p.shells : 0, col: '#d8b070', label: `龟壳 ${E.objs.length}/${E.p.shells}` };
    return { name: T.name, weak: false, bar, objs: E.objs.length };
  }
  // 精英倒下：上报给团本的事件（规则核心 EV.elite，v = 精英 id）
  const done = E => { E.dead = true; return { e: 'elite', v: E.id }; };
  return { TYPES, ELEMS, ELEM_COL, create, tick, on, mul, view, done };
})();

// ---- 精英登记表（数据驱动）：新团本在自己的内容文件里 defineRaidElite('siEliteDoor', { … })，房间里写 eliteSpec: 'siEliteDoor' ----
const RAID_ELITES = {};
function defineRaidElite(id, spec) {
  if (!RAID_ELITE.TYPES[spec.type]) throw new Error('精英 ' + id + '：没有这种破防条件 ' + spec.type);
  RAID_ELITES[id] = Object.assign({ id, name: id, mon: null, p: {}, hp: 1, atk: 1 }, spec, { id });
  return RAID_ELITES[id];
}
const raidEliteSpec = s => typeof s === 'string' ? RAID_ELITES[s] || null : s && s.type ? s : null;

// ---- 运行时（只在主机跑；单元测试不碰）----
const RE_OBJ = { ball: ['rmObj_crystal', 'crystal'], orb: ['rmObj_crystal', 'crystal'], clone: ['rmObj_totem', 'totem'], shell: ['rmObj_pillar', 'pillar'] };
function raidEliteAttach(m, specIn, ctx) {
  const spec = raidEliteSpec(specIn); if (!m || !spec || m.guest || m.puppet) return null;
  const E = RAID_ELITE.create(spec), objs = {};
  if (spec.hp && spec.hp !== 1) { m.hp = m.hpMax = Math.round(m.hp * spec.hp); }
  if (spec.atk && spec.atk !== 1) m.atk *= spec.atk;
  if (spec.name) m.name = spec.name;
  m.raidElite = E; m.raidEliteSpec = spec;
  const P = () => msSelf(), setMul = () => msMulSet(m, 'eliteShield', RAID_ELITE.mul(E));
  setMul();
  const spawnObj = o => {
    const [kind, shape] = RE_OBJ[o.what] || RE_OBJ.ball, W = msRoomW(), x = clamp(m.x + (Math.random() * 2 - 1) * 260, 60, W - 60), y = clamp(m.y + (Math.random() * 2 - 1) * 60, 10, DEPTH - 10);
    const e = spawnMonster(kind, x, y, { lvl: m.lvl }), col = o.col || (o.what === 'orb' ? '#7affd0' : o.what === 'clone' ? '#c090ff' : '#d8b070');
    e.model = new MsObjModel(shape, col, (MON[kind] || {}).h || 80); e.model.ent = e; e.name = (RAID_ELITE.TYPES[E.type].name || '') + (o.elem ? '·' + o.elem : '');
    e.hp = e.hpMax = 1e6; e.__hp = e.hp; e.__need = o.hits || 1; e.__n = 0; e.invul = 0; e.aiCd = 1e9; e.msReKey = o.what;
    if (o.what === 'orb') { e.__fly = { x0: x, y0: y, t: 0, T: o.travel || 6 }; }
    objs[o.what + ':' + o.i] = e; return e;
  };
  const drop = key => { const e = objs[key]; if (e) { e.__gone = true; e.remove = true; delete objs[key]; } };
  const apply = list => {
    for (const o of list) {
      switch (o.k) {
        case 'spawn': spawnObj(o); break;
        case 'expire': drop(o.what + ':' + o.i); break;
        case 'heal': { const h = Math.round(m.hpMax * o.pct); m.hp = Math.min(m.hpMax, m.hp + h); addNumber(h, m.x, m.y, m.z, { heal: true }); break; }
        case 'break': if (m.act) m.endAct(); m.setState('hit'); msGroggyFx(m); msSay(m, '破防！', '#7aff9a', 15); setMul(); break;
        case 'unbreak': setMul(); break;
        case 'interrupt': if (m.act) m.endAct(); m.stun = Math.max(m.stun || 0, 0.6); break;
        case 'punish':
          if (o.id === 'eyeReflect') { if (typeof rmHurtWho === 'function') rmHurtWho(m, o.who || 'me', o.frac); else if (P()) rmHurt(m, P(), o.frac); toastMsg('睁眼期间攻击了精英——被反伤！', '#ff8a6a'); break; }
          if (typeof rmWipeAll === 'function') rmWipeAll(m, o.frac, o.id); else if (P()) rmHurt(m, P(), o.frac);   // rmWipeAll：全团（含队员）按最大 HP 比例结算，见 raid_mech_rt.js
          toastMsg('没能破解——精英发动了攻击！', '#ff8a6a'); break;
        case 'reflect': m.raidReflect = !!o.on; fxText(o.on ? '睁眼' : '闭眼', m.x, m.y, m.z + m.h * (m.scale || 1) + 30, { col: o.on ? '#ff4a6a' : '#c8d8ff', size: 14, dur: 1.2 }); break;
        case 'cast': msSay(m, o.text, '#ffb08a', 14); break;
        case 'warn': toastMsg(`${RAID_ELITE.TYPES[E.type].name}：${o.text}`, '#ffd08a'); break;
      }
    }
    setMul();
  };
  apply(RAID_ELITE.tick(E, 0));
  const hud = addFx({ x: 0, y: -1e5, z: 0, dur: 1e9, draw(c) {
    if (m.dead || !ents.includes(m)) { this.dur = 0; return; }
    const V = RAID_ELITE.view(E); if (!V.bar) return;
    const X = sx(m.x), Y = sy(m.y, m.z + m.h * (m.scale || 1)) - 34; msBar(c, X - 44, Y, 88, V.bar.k, V.bar.col, V.bar.label);
  } });
  msTicker(dt => {
    if (E.dead) return;
    if (m.dead || m.remove) {   // 精英倒下：收掉场上的物件，上报团本（规则核心按节点 elites[id].fx 执行全局效果）
      const r = RAID_ELITE.done(E); for (const k of Object.keys(objs)) drop(k); hud.dur = 0;
      msMulSet(m, 'eliteShield', null);
      if (typeof raidNet !== 'undefined' && raidNet.eliteKill) raidNet.eliteKill(E.id);
      bus.emit('raidEliteDown', { id: E.id, type: E.type, x: m.x, y: m.y });
      return;
    }
    // 物件被打 / 被打碎 → 事件；拦截球的飞行
    for (const key of Object.keys(objs)) {
      const e = objs[key], [what, i] = key.split(':');
      if (e.dead || e.remove || e.hp <= 0) { if (!e.__gone) { delete objs[key]; apply(RAID_ELITE.on(E, { k: { ball: 'ball', orb: 'intercept', clone: 'cloneDead', shell: 'shellBroken' }[what], i: +i })); } continue; }
      if (e.hp < e.__hp) { e.__n++; e.hp = e.hpMax; if (e.__n >= e.__need) { e.__gone = true; e.remove = true; delete objs[key]; apply(RAID_ELITE.on(E, { k: { ball: 'ball', orb: 'intercept', clone: 'cloneDead', shell: 'shellBroken' }[what], i: +i })); continue; } }
      e.__hp = e.hp;
      if (e.__fly) { const F = e.__fly; F.t += dt; const k = Math.min(1, F.t / F.T); e.x = F.x0 + (m.x - F.x0) * k; e.y = F.y0 + (m.y - F.y0) * k; }
    }
    apply(RAID_ELITE.tick(E, dt));
  });
  // 反射：睁眼期间被打 → 事件（命中者承受 reflect 惩罚）；破招：被打 → hit 事件（窗口判定在逻辑里）
  const onHit0 = m.onDamaged;
  m.onDamaged = function (t, a, ...r) {
    if (E.type === 'eyeGuard') apply(RAID_ELITE.on(E, { k: 'hitEye', who: typeof rmWho === 'function' ? rmWho(a) : 'me' })); else if (E.type === 'counterBreak') apply(RAID_ELITE.on(E, { k: 'hit' }));
    return onHit0 && onHit0.call(this, t, a, ...r);
  };
  return E;
}
