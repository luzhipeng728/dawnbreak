/* =====================================================================
   团本领主机制核心（RAID_MECH，docs/RAID_SIROCO.md §10）：纯逻辑——不碰 DOM / ents / game，只吃事件、吐事件。
   浏览器（game/raid_mech_rt.js 把它接到领主身上）和 node 测试（test/raid_mech_core.mjs，固定种子）共用同一份代码。
   - 领主脚本 script：出场无敌 intro → 战斗 fight（可选的固定出招循环 loop、定时机制招 atk）→ 血量到门槛 / 定时 → 读条 cast，
     读条期间从虚弱池 weak.pool 抽一个谜题；解开 → 虚弱 break（受伤 ×mul）；没解开 → 灭团 wipe（按最大 HP 结算，普通模式默认 100%）
   - 谜题原语 PUZ：pads 顺序踩板 / heartbeat 心跳 / realBody 真身 / orbs 属性球 / path 地板路线 / guide 引导光球 / burial 掩埋救援 /
     tether 连线 / breath 呼吸槽 / reflect 反射 / gem 搬宝石 / crystals 水晶 / swords 日月之剑 / facing 朝向 / soulSwap 灵魂互换 /
     souls 守门人之魂（跟 BGM 节拍）/ crouch 全屏击倒（只有蹲下能躲）
   - 玩家状态 STATUS：叠层 / 计时 / 满层触发（侵蚀 → 石化、掩埋、搬运、灵魂颜色……），运行时把 eff 翻译成游戏里的异常状态
   坐标：x ∈ [0, W]（房间宽）、y ∈ [0, D]（纵深）；距离按地面椭圆（纵向 ×1/0.45）算，和 inGround 一致。
   输入事件 ev：{ k: 'pos', who, x, y, face, z, crouch } | { k: 'anchor', x, y, face }（领主位置）| { k: 'hit', tag, i, who } | { k: 'kill', tag, i, who }
               | { k: 'mash', who }（连打挣脱）| { k: 'hurt', who }（被领主打中）
   输出事件 out：{ k: 'hurt', who, frac, down, why } | { k: 'status' / 'unstatus', who, id, n, dur } | { k: 'say', text, col } | { k: 'tp', who, x, y }
               | { k: 'cue' }（BGM 节拍）| { k: 'invul', on } | { k: 'cast', id, name, dur, puzzle } | { k: 'break', dur, mul } | { k: 'unbreak' }
               | { k: 'wipe', frac, down } | { k: 'skill', id } | { k: 'solve' / 'fail', id, why } | { k: 'line', id }（台词）
   谜题状态里的 objs（要打的物件：{ tag, i, x, y, shape, col, hits, alive, keep, label, glow, at }）和 marks（地面标记：{ x, y, r, col, label, on, shape }）
   由运行时通用地生成 / 绘制，所以新加谜题只写数据和规则，不写画面。
   ===================================================================== */
const RAID_MECH = (() => {
  const GRY = 0.45;
  const rng = seed => { let s = (seed >>> 0) || 1; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const shuffle = (a, R) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const gdist = (a, b) => Math.hypot(a.x - b.x, (a.y - b.y) / GRY);
  const ELEM = { fire: ['火', '#ff7a3a'], ice: ['冰', '#8ad8ff'], light: ['光', '#ffe070'], dark: ['暗', '#a070ff'], sun: ['日', '#ffc040'], moon: ['月', '#8ab0ff'] };

  /* ---------------- 玩家状态 ---------------- */
  // eff：运行时翻译成的异常（root 定身 / slow 减速 / stun 眩晕 / blind 失明 / none 只显示）；max 满层触发 onMax（另一个状态）
  const STATUS = {
    erode: { name: '侵蚀', col: '#a070ff', max: 5, dur: 20, eff: 'none', onMax: 'petrify' },
    petrify: { name: '石化', col: '#9a9a9a', max: 1, dur: 3, eff: 'stun' },
    buried: { name: '掩埋', col: '#b08a5a', max: 1, dur: 0, eff: 'root' },
    carry: { name: '搬运中', col: '#7affd0', max: 1, dur: 0, eff: 'slow' },
    soul_sun: { name: '日之魂', col: '#ffc040', max: 1, dur: 0, eff: 'none' },
    soul_moon: { name: '月之魂', col: '#8ab0ff', max: 1, dur: 0, eff: 'none' },
    suffocate: { name: '窒息', col: '#6ab0ff', max: 1, dur: 2, eff: 'stun' },
    chill: { name: '寒气', col: '#bfefff', max: 3, dur: 8, eff: 'slow', onMax: 'freeze' },
    freeze: { name: '冰冻', col: '#8ad8ff', max: 1, dur: 2, eff: 'stun' },
    gloom: { name: '黑暗', col: '#4a3a6a', max: 1, dur: 6, eff: 'blind' },
  };
  // S = { id: { n, t } }；返回满层触发的状态 id（已经加上），没有返回 null
  function stAdd(S, id, o = {}) {
    const D = STATUS[id] || { max: 1, dur: 0 }, cur = S[id], max = o.max ?? D.max ?? 1;
    const n = Math.min(max, (cur ? cur.n : 0) + (o.n ?? 1));
    S[id] = { n, t: o.dur ?? D.dur ?? 0 };
    if (n >= max && D.onMax) { delete S[id]; stAdd(S, D.onMax); return D.onMax; }
    return null;
  }
  // 计时（t = 0 表示一直有效）；返回到期的 id 列表
  function stTick(S, dt) { const gone = []; for (const id of Object.keys(S)) { const s = S[id]; if (!s.t) continue; s.t -= dt; if (s.t <= 0) { delete S[id]; gone.push(id); } } return gone; }
  const stHas = (S, id) => !!S[id], stN = (S, id) => (S[id] ? S[id].n : 0), stDel = (S, id) => { const had = !!S[id]; delete S[id]; return had; };

  /* ---------------- 谜题原语 ---------------- */
  const PUZ = {};
  const def = (id, d) => { PUZ[id] = { id, survive: false, defaults: {}, ...d }; };
  const spots = (n, C, R, y0 = 0.25, y1 = 0.75) => Array.from({ length: n }, (_, i) => ({ x: Math.round(C.W * (0.18 + 0.64 * (n > 1 ? i / (n - 1) : 0.5))), y: Math.round(C.D * (i % 2 ? y1 : y0) + (R() - 0.5) * C.D * 0.1) }));
  const hurt = (st, who, frac, why, down = true) => st.out.push({ k: 'hurt', who, frac, why, down });
  const say = (st, text, col = '#ffe070') => st.out.push({ k: 'say', text, col });
  const P = st => st.pl || (st.pl = {});
  const inMark = (pl, m) => pl && gdist(pl, m) < m.r;

  // 顺序踩板：n 块板按顺序踩（peek 秒内显示序号，之后要凭记忆）；踩错 = 挨打、从头来（reset: false 不重来）；错 maxWrong 次以上失败
  def('pads', { defaults: { n: 4, dur: 18, r: 48, peek: 4, reset: true, hurt: 0.08, maxWrong: 3 }, name: '顺序踩板', hint: '按出现的序号依次踩上发光的板',
    init(p, R, C) { const pos = shuffle(spots(p.n, C, R), R); return { seq: shuffle([...Array(p.n).keys()], R), i: 0, wrong: 0, on: {}, marks: pos.map((q, k) => ({ ...q, r: p.r, col: '#8a8aa0', label: '', on: false, k })) }; },
    on(st, p, ev) {
      if (ev.k !== 'pos') return;
      const pad = st.marks.findIndex(m => inMark(ev, m)), prev = st.on[ev.who] ?? -1; st.on[ev.who] = pad;
      if (pad < 0 || pad === prev || st.marks[pad].on) return;
      if (st.seq[st.i] === pad) { st.marks[pad].on = true; st.i++; if (st.i >= p.n) st.res = 'solve'; return; }
      st.wrong++; hurt(st, ev.who, p.hurt, 'pads', false); say(st, '顺序错了！', '#ff8a8a');
      if (p.reset) { st.i = 0; for (const m of st.marks) m.on = false; }
      if (st.wrong > p.maxWrong) st.res = 'fail';
    },
    tick(st, p) { const show = st.t < p.peek; st.seq.forEach((pad, k) => { const m = st.marks[pad]; m.label = show || m.on ? String(k + 1) : '?'; m.col = m.on ? '#7aff9a' : show ? '#ffe070' : '#8a8aa0'; }); } });

  // 心跳：心脏每 period 秒亮 window 秒，亮的时候打一下算一拍（每拍只算一次），不亮的时候打 = 挨打；need 拍解开
  def('heartbeat', { defaults: { period: 2.2, window: 0.75, need: 4, dur: 20, hurt: 0.05 }, name: '心跳', hint: '心脏发光时攻击它',
    init(p, R, C) { return { n: 0, last: -1, objs: [{ tag: 'heart', i: 0, x: Math.round(C.W * (0.3 + R() * 0.4)), y: Math.round(C.D * 0.5), shape: 'heart', col: '#ff6a8a', hits: 99, keep: true, alive: true, label: '', glow: false }] }; },
    beat: (st, p) => (st.t % p.period) < p.window,
    on(st, p, ev) {
      if (ev.k !== 'hit' || ev.tag !== 'heart') return;
      const b = Math.floor(st.t / p.period);
      if (PUZ.heartbeat.beat(st, p)) { if (b !== st.last) { st.last = b; st.n++; if (st.n >= p.need) st.res = 'solve'; } }
      else { hurt(st, ev.who, p.hurt, 'heartbeat', false); }
    },
    tick(st, p) { const o = st.objs[0]; o.glow = PUZ.heartbeat.beat(st, p); o.label = `${st.n}/${p.need}`; } });

  // 真身：n 个分身里只有一个是真的（每 every 秒闪一下 tell）；打到真的 = 解开，打到假的 = 挨打、假的消失；错 maxWrong 次以上失败
  def('realBody', { defaults: { n: 4, dur: 16, every: 3, flash: 0.5, hurt: 0.12, maxWrong: 1, col: '#a070ff' }, name: '真身', hint: '分身里只有一个会闪光——打它',
    init(p, R, C) { const real = Math.floor(R() * p.n); return { real, wrong: 0, objs: spots(p.n, C, R).map((q, i) => ({ tag: 'clone', i, ...q, shape: 'totem', col: p.col, hits: 99, keep: true, alive: true, label: '', glow: false })) }; },
    on(st, p, ev) {
      if (ev.k !== 'hit' || ev.tag !== 'clone') return;
      const o = st.objs[ev.i]; if (!o || !o.alive) return;
      if (ev.i === st.real) { st.res = 'solve'; return; }
      o.alive = false; st.wrong++; hurt(st, ev.who, p.hurt, 'realBody'); say(st, '是假的！', '#ff8a8a');
      if (st.wrong > p.maxWrong) st.res = 'fail';
    },
    tick(st, p) { const k = st.t % p.every; st.objs[st.real].glow = k < p.flash; } });

  // 属性球：按领主头顶给的顺序打碎属性球；打错 = 挨打、全部复原重来
  def('orbs', { defaults: { elems: ['fire', 'ice', 'light', 'dark'], dur: 20, hits: 3, hurt: 0.08 }, name: '属性球', hint: '按顺序打碎属性球',
    init(p, R, C) { const pos = shuffle(spots(p.elems.length, C, R), R); return { seq: shuffle(p.elems, R), k: 0, objs: p.elems.map((e, i) => ({ tag: 'orb', i, ...pos[i], shape: 'crystal', col: (ELEM[e] || ['', '#fff'])[1], hits: p.hits, alive: true, label: (ELEM[e] || [e])[0], elem: e })) }; },
    on(st, p, ev) {
      if (ev.k !== 'kill' || ev.tag !== 'orb') return;
      const o = st.objs[ev.i]; if (!o) return; o.alive = false;
      if (o.elem === st.seq[st.k]) { st.k++; if (st.k >= st.seq.length) st.res = 'solve'; return; }
      hurt(st, ev.who, p.hurt, 'orbs', false); say(st, '顺序错了：属性球复原了', '#ff8a8a'); st.k = 0; for (const q of st.objs) q.alive = true;
    },
    text: st => st.seq.map((e, i) => (i < st.k ? '✓' : (ELEM[e] || [e])[0])).join(' → ') });

  // 地板路线：cols × rows 的地板，只有发光的那条路能走；踩到别的格 = 挨打、送回起点；走到最后一列解开；掉下去 maxFalls 次以上失败
  def('path', { defaults: { cols: 7, rows: 3, dur: 16, hurt: 0.1, maxFalls: 2, x0: 0.15, x1: 0.85 }, name: '地板路线', hint: '沿着发光的地板走到对面',
    init(p, R, C) {
      const cells = new Set(); let r = Math.floor(R() * p.rows); const path = [];
      for (let c = 0; c < p.cols; c++) { cells.add(c + ',' + r); path.push([c, r]); if (c < p.cols - 1) { const nr = clamp(r + Math.floor(R() * 3) - 1, 0, p.rows - 1); if (nr !== r) { cells.add((c + 1) + ',' + r); r = nr; } } }
      const cw = C.W * (p.x1 - p.x0) / p.cols, ch = C.D / p.rows, marks = [];
      for (let c = 0; c < p.cols; c++) for (let rr = 0; rr < p.rows; rr++) marks.push({ x: Math.round(C.W * p.x0 + cw * (c + 0.5)), y: Math.round(ch * (rr + 0.5)), w: Math.round(cw), h: Math.round(ch), shape: 'tile', r: 0, col: cells.has(c + ',' + rr) ? '#7affd0' : '#ff4a4a', on: cells.has(c + ',' + rr), label: '' });
      return { cells: [...cells], start: path[0], falls: 0, cw, ch, marks, W: C.W, D: C.D };
    },
    cell(st, p, ev) { const c = Math.floor((ev.x - st.W * p.x0) / st.cw), r = clamp(Math.floor(ev.y / st.ch), 0, p.rows - 1); return c < 0 || c >= p.cols ? null : [c, r]; },
    on(st, p, ev) {
      if (ev.k !== 'pos' || (ev.z || 0) > 12) return;
      const cr = PUZ.path.cell(st, p, ev); if (!cr) return;
      if (!st.cells.includes(cr[0] + ',' + cr[1])) {
        st.falls++; hurt(st, ev.who, p.hurt, 'path'); say(st, '踩空了！回到起点', '#ff8a8a');
        st.out.push({ k: 'tp', who: ev.who, x: Math.round(st.W * p.x0 - 30), y: Math.round(st.ch * (st.start[1] + 0.5)) });
        if (st.falls > p.maxFalls) st.res = 'fail'; return;
      }
      if (cr[0] === p.cols - 1) st.res = 'solve';
    } });

  // 引导光球：走近光球它会跟着你，把 n 个都带进中间的祭坛
  def('guide', { defaults: { n: 3, dur: 24, grab: 70, speed: 150, goal: 60, lag: 34 }, name: '引导光球', hint: '走近光球，把它们带进祭坛',
    init(p, R, C) { const goal = { x: Math.round(C.W / 2), y: Math.round(C.D / 2), r: p.goal, col: '#ffe070', label: '祭坛', on: false, shape: 'circle' }; const orbs = spots(p.n, C, R, 0.15, 0.85).map(q => ({ ...q, x: q.x < goal.x ? Math.max(40, q.x - C.W * 0.1) : Math.min(C.W - 40, q.x + C.W * 0.1), r: 16, col: '#bfefff', label: '光', on: false, shape: 'orb' })); return { goal, orbs, done: 0, marks: [goal, ...orbs] }; },
    on(st, p, ev) { if (ev.k === 'pos') P(st)[ev.who] = { x: ev.x, y: ev.y }; },
    tick(st, p, dt) {
      for (const o of st.orbs) {
        if (o.on) continue;
        let best = null, bd = 1e9; for (const w in P(st)) { const q = st.pl[w], d = gdist(q, o); if (d < bd) { bd = d; best = q; } }
        if (best && bd < p.grab && bd > p.lag) { const k = Math.min(1, p.speed * dt / bd); o.x += (best.x - o.x) * k; o.y += (best.y - o.y) * k; }
        if (gdist(o, st.goal) < st.goal.r) { o.on = true; o.x = st.goal.x; o.y = st.goal.y; st.done++; }
      }
      st.goal.label = `祭坛 ${st.done}/${p.n}`;
      if (st.done >= p.n) st.res = 'solve';
    } });

  // 掩埋救援：一个人被埋住（定身），队友打墓碑 / 自己连打攻击挣脱，hits 下解开；到点没出来 = 重伤
  def('burial', { defaults: { hits: 10, dur: 7, hurt: 0.45 }, name: '掩埋', hint: '连打攻击键挣脱（队友可以打墓碑）',
    init(p, R, C) { const who = C.players[Math.floor(R() * C.players.length)]; return { who, n: 0, objs: [{ tag: 'tomb', i: 0, at: who, x: 0, y: 0, shape: 'pillar', col: '#b08a5a', hits: 99, keep: true, alive: true, label: '' }], out0: [{ k: 'status', who, id: 'buried' }] }; },
    on(st, p, ev) { if ((ev.k === 'mash' && ev.who === st.who) || (ev.k === 'hit' && ev.tag === 'tomb')) { st.n++; st.objs[0].label = `${st.n}/${p.hits}`; if (st.n >= p.hits) { st.res = 'solve'; st.out.push({ k: 'unstatus', who: st.who, id: 'buried' }); } } },
    onEnd(st, p) { if (st.res !== 'solve') { st.out.push({ k: 'unstatus', who: st.who, id: 'buried' }); hurt(st, st.who, p.hurt, 'burial'); } } });

  // 连线：和领主之间连着线，离得太近（< min）每 tick 秒挨一下；撑过 dur 秒解开，挨了 maxBad 下以上失败
  def('tether', { defaults: { dur: 8, min: 260, tick: 0.5, hurt: 0.04, maxBad: 6 }, name: '连线', hint: '离领主远一点，把线拉开', survive: true,
    init() { return { bad: 0, acc: 0, anchor: null, marks: [{ x: 0, y: 0, r: 0, col: '#ff6a6a', label: '', on: false, shape: 'ring', at: 'anchor' }] }; },
    on(st, p, ev) { if (ev.k === 'pos') P(st)[ev.who] = { x: ev.x, y: ev.y }; else if (ev.k === 'anchor') st.anchor = { x: ev.x, y: ev.y }; },
    tick(st, p, dt) {
      const m = st.marks[0]; m.r = p.min; if (st.anchor) { m.x = st.anchor.x; m.y = st.anchor.y; }
      st.acc += dt; if (st.acc < p.tick || !st.anchor) return; st.acc -= p.tick;
      for (const w in P(st)) if (gdist(st.pl[w], st.anchor) < p.min) { st.bad++; hurt(st, w, p.hurt, 'tether', false); }
      if (st.bad > p.maxBad) st.res = 'fail';
    } });

  // 呼吸槽：离开气泡每秒掉 drain，进气泡每秒回 refill；见底 = 窒息（挨打 + 眩晕），窒息 maxBad 次以上失败；气泡每 move 秒换位置
  def('breath', { defaults: { max: 100, drain: 11, refill: 45, zones: 2, r: 60, dur: 16, move: 6, hurt: 0.15, maxBad: 1 }, name: '呼吸', hint: '待在气泡里换气', survive: true,
    init(p, R, C) { const st = { g: {}, bad: 0, mv: 0, marks: [] }; PUZ.breath.place(st, p, R, C); return st; },
    place(st, p, R, C) { st.marks = Array.from({ length: p.zones }, (_, i) => ({ x: Math.round(C.W * (0.15 + 0.7 * ((i + R() * 0.8) / p.zones))), y: Math.round(C.D * (0.2 + 0.6 * R())), r: p.r, col: '#6ab0ff', label: '气泡', on: true, shape: 'circle' })); },
    on(st, p, ev) { if (ev.k === 'pos') { P(st)[ev.who] = { x: ev.x, y: ev.y }; if (st.g[ev.who] == null) st.g[ev.who] = p.max; } },
    tick(st, p, dt, R, C) {
      st.mv += dt; if (st.mv >= p.move) { st.mv = 0; PUZ.breath.place(st, p, R, C); }
      for (const w in P(st)) {
        const inside = st.marks.some(m => inMark(st.pl[w], m));
        st.g[w] = clamp(st.g[w] + (inside ? p.refill : -p.drain) * dt, 0, p.max);
        if (st.g[w] <= 0) { st.bad++; st.g[w] = p.max * 0.5; hurt(st, w, p.hurt, 'breath', false); st.out.push({ k: 'status', who: w, id: 'suffocate' }); if (st.bad > p.maxBad) st.res = 'fail'; }
      }
    } });

  // 反射：领主周期性开反射罩（on 秒开、off 秒关），开着时打它 = 被反伤；撑过 dur 秒解开，反伤 maxBad 次以上失败
  def('reflect', { defaults: { dur: 14, on: 3, off: 3, hurt: 0.04, maxBad: 5 }, name: '反射', hint: '紫色护罩亮着的时候别打领主', survive: true,
    init() { return { bad: 0, up: true, marks: [{ x: 0, y: 0, r: 90, col: '#c080ff', label: '反射', on: true, shape: 'ring', at: 'anchor' }] }; },
    on(st, p, ev) { if (ev.k === 'anchor') { st.marks[0].x = ev.x; st.marks[0].y = ev.y; } else if (ev.k === 'hit' && ev.tag === 'boss' && st.up) { st.bad++; hurt(st, ev.who, p.hurt, 'reflect', false); if (st.bad > p.maxBad) st.res = 'fail'; } },
    tick(st, p) { st.up = (st.t % (p.on + p.off)) < p.on; st.marks[0].on = st.up; st.marks[0].label = st.up ? '反射' : ''; } });

  // 搬宝石：捡起宝石（减速）搬到祭坛；搬的时候被打中会掉在原地；n 个都送到解开
  def('gem', { defaults: { n: 2, dur: 26, r: 40, hurt: 0 }, name: '搬宝石', hint: '捡起宝石搬到祭坛（被打中会掉）',
    init(p, R, C) { const altar = { x: Math.round(C.W * (R() < 0.5 ? 0.12 : 0.88)), y: Math.round(C.D / 2), r: 55, col: '#ffe070', label: '祭坛', on: false, shape: 'circle' }; const left = altar.x < C.W / 2, gems = spots(p.n, C, R).map(q => ({ ...q, x: Math.round(C.W * ((left ? 0.5 : 0.15) + 0.35 * (q.x / C.W - 0.18) / 0.64)), r: p.r * 0.5, col: '#7affd0', label: '宝石', on: false, shape: 'orb', by: null })); return { altar, gems, done: 0, carry: {}, marks: [altar, ...gems] }; },
    on(st, p, ev) {
      if (ev.k === 'hurt') { const g = st.carry[ev.who]; if (g != null) { const q = P(st)[ev.who] || {}; Object.assign(st.gems[g], { x: q.x, y: q.y, by: null }); delete st.carry[ev.who]; st.out.push({ k: 'unstatus', who: ev.who, id: 'carry' }); say(st, '宝石掉了！'); } return; }
      if (ev.k !== 'pos') return; P(st)[ev.who] = { x: ev.x, y: ev.y };
      const g = st.carry[ev.who];
      if (g != null) { Object.assign(st.gems[g], { x: ev.x, y: ev.y }); if (inMark(ev, st.altar)) { st.gems[g].on = true; st.gems[g].by = null; Object.assign(st.gems[g], { x: st.altar.x, y: st.altar.y }); delete st.carry[ev.who]; st.done++; st.out.push({ k: 'unstatus', who: ev.who, id: 'carry' }); if (st.done >= p.n) st.res = 'solve'; } return; }
      const k = st.gems.findIndex(q => !q.on && q.by == null && gdist(ev, q) < p.r); if (k >= 0) { st.gems[k].by = ev.who; st.carry[ev.who] = k; st.out.push({ k: 'status', who: ev.who, id: 'carry' }); }
    },
    tick(st, p) { st.altar.label = `祭坛 ${st.done}/${p.n}`; } });

  // 水晶：dur 秒内打碎 n 个水晶
  def('crystals', { defaults: { n: 4, dur: 15, hits: 4, col: '#b890ff' }, name: '水晶', hint: '打碎全部水晶',
    init(p, R, C) { return { left: p.n, objs: spots(p.n, C, R).map((q, i) => ({ tag: 'crystal', i, ...q, shape: 'crystal', col: p.col, hits: p.hits, alive: true, label: '' })) }; },
    on(st, p, ev) { if (ev.k === 'kill' && ev.tag === 'crystal' && st.objs[ev.i] && st.objs[ev.i].alive) { st.objs[ev.i].alive = false; st.left--; if (st.left <= 0) st.res = 'solve'; } } });

  // 日月之剑：左边日之剑、右边月之剑；每 gap 秒领主亮出日 / 月，warn 秒后结算，站在对应的剑那边才没事；错 maxMiss 次以上失败
  def('swords', { defaults: { rounds: 3, gap: 4.5, warn: 2.6, hurt: 0.15, maxMiss: 1, r: 80 }, name: '日月之剑', hint: '领主亮出日 / 月：站到对应的剑旁边', survive: true,
    init(p, R, C) { return { r: 0, sign: null, miss: 0, signs: Array.from({ length: p.rounds }, () => (R() < 0.5 ? 'sun' : 'moon')), marks: [{ x: Math.round(C.W * 0.2), y: Math.round(C.D / 2), r: p.r, col: '#ffc040', label: '日', on: false, shape: 'circle', side: 'sun' }, { x: Math.round(C.W * 0.8), y: Math.round(C.D / 2), r: p.r, col: '#8ab0ff', label: '月', on: false, shape: 'circle', side: 'moon' }] }; },
    on(st, p, ev) { if (ev.k === 'pos') P(st)[ev.who] = { x: ev.x, y: ev.y }; },
    tick(st, p) {
      const k = Math.floor(st.t / p.gap), ph = st.t - k * p.gap;
      if (k < p.rounds && k === st.r) {
        st.sign = st.signs[k]; for (const m of st.marks) m.on = m.side === st.sign;
        if (ph >= p.warn) {
          const m = st.marks.find(q => q.side === st.sign);
          for (const w in P(st)) if (!inMark(st.pl[w], m)) { st.miss++; hurt(st, w, p.hurt, 'swords'); }
          st.r++; st.sign = null; for (const q of st.marks) q.on = false;
          if (st.miss > p.maxMiss) st.res = 'fail';
        }
      }
      if (st.r >= p.rounds && !st.res) st.res = 'solve';
    },
    text: st => (st.sign ? `${ELEM[st.sign][0]}！` : '') });

  // 朝向：windup 秒后结算；away = 背对领主才安全、toward = 面朝领主才安全、random = 每次随机（显示在提示里）
  def('facing', { defaults: { windup: 2.2, mode: 'away', hurt: 0.2, dur: 3 }, name: '凝视', hint: '按提示面朝 / 背对领主', survive: true,
    init(p, R) { return { mode: p.mode === 'random' ? (R() < 0.5 ? 'away' : 'toward') : p.mode, done: false, anchor: null }; },
    on(st, p, ev) { if (ev.k === 'pos') P(st)[ev.who] = { x: ev.x, face: ev.face }; else if (ev.k === 'anchor') st.anchor = { x: ev.x }; },
    tick(st, p) {
      if (st.done || st.t < p.windup || !st.anchor) return; st.done = true; let bad = 0;
      for (const w in P(st)) { const q = st.pl[w], toward = Math.sign(st.anchor.x - q.x || 1) === Math.sign(q.face || 1); if ((st.mode === 'away') === toward) { bad++; hurt(st, w, p.hurt, 'facing'); } }
      st.res = bad ? 'fail' : 'solve';
    },
    text: st => (st.mode === 'away' ? '背对领主！' : '面朝领主！') });

  // 灵魂互换：每个人身上带日 / 月之魂，只能打碎同色的魂（打异色 = 挨打）；swapAt 秒时互换颜色；打碎 need 个解开
  def('soulSwap', { defaults: { dur: 18, need: 4, per: 3, swapAt: 8, hurt: 0.08, hits: 2 }, name: '灵魂互换', hint: '只打和自己同色的魂（中途会互换）',
    init(p, R, C) {
      const soul = {}; C.players.forEach((w, i) => { soul[w] = (i + (R() < 0.5 ? 0 : 1)) % 2 ? 'moon' : 'sun'; });
      const pos = spots(p.per * 2, C, R), cols = shuffle([...Array(p.per).fill('sun'), ...Array(p.per).fill('moon')], R);
      return { soul, n: 0, swapped: false, out0: Object.entries(soul).map(([who, s]) => ({ k: 'status', who, id: 'soul_' + s })), objs: pos.map((q, i) => ({ tag: 'soul', i, ...q, shape: 'crystal', col: ELEM[cols[i]][1], side: cols[i], hits: p.hits, alive: true, label: ELEM[cols[i]][0] })) };
    },
    on(st, p, ev) {
      if (ev.k !== 'kill' || ev.tag !== 'soul') return; const o = st.objs[ev.i]; if (!o || !o.alive) return;
      if (o.side === st.soul[ev.who]) { o.alive = false; st.n++; if (st.n >= p.need) st.res = 'solve'; return; }
      hurt(st, ev.who, p.hurt, 'soulSwap', false); say(st, '颜色不对！魂复原了', '#ff8a8a'); o.alive = true; o.respawn = (o.respawn || 0) + 1;
    },
    tick(st, p) {
      if (st.swapped || st.t < p.swapAt) return; st.swapped = true; say(st, '灵魂互换了！', '#ffe070');
      for (const w in st.soul) { const a = st.soul[w], b = a === 'sun' ? 'moon' : 'sun'; st.soul[w] = b; st.out.push({ k: 'unstatus', who: w, id: 'soul_' + a }, { k: 'status', who: w, id: 'soul_' + b }); }
      if (!st.objs.some(o => o.alive && Object.values(st.soul).includes(o.side))) for (const o of st.objs) if (Object.values(st.soul).includes(o.side)) o.alive = true;
    },
    onEnd(st) { for (const w in st.soul) st.out.push({ k: 'unstatus', who: w, id: 'soul_' + st.soul[w] }); } });

  // 守门人之魂：魂只在 BGM 节拍（每 cue 秒一次）之后的 window 秒内能打碎；节拍外打它 = 被反伤；全部打碎解开
  def('souls', { defaults: { n: 4, cue: 5, window: 1.8, dur: 28, hurt: 0.04, hits: 3, col: '#c080ff' }, name: '守门人之魂', hint: '听节拍：鼓点响起后才能打碎魂',
    init(p, R, C) { return { left: p.n, open: false, beat: -1, objs: spots(p.n, C, R).map((q, i) => ({ tag: 'soul', i, ...q, shape: 'crystal', col: p.col, hits: p.hits, alive: true, keep: true, label: '', glow: false })) }; },
    on(st, p, ev) {
      if (ev.tag !== 'soul') return; const o = st.objs[ev.i]; if (!o || !o.alive) return;
      if (ev.k === 'hit' && !st.open) { hurt(st, ev.who, p.hurt, 'souls', false); return; }
      if (ev.k === 'hit' && st.open) { o.dmg = (o.dmg || 0) + 1; if (o.dmg >= p.hits) { o.alive = false; st.left--; if (st.left <= 0) st.res = 'solve'; } }
    },
    tick(st, p) {
      const b = Math.floor(st.t / p.cue); if (b > 0 && b !== st.beat) { st.beat = b; st.out.push({ k: 'cue' }); }
      st.open = st.beat > 0 && (st.t - st.beat * p.cue) < p.window; for (const o of st.objs) { o.glow = st.open; o.label = o.alive ? `${o.dmg || 0}/${p.hits}` : ''; }
    } });

  // 全屏击倒：windup 秒后全场冲击，只有蹲下（按住 ↓）的人没事，跳起来也会被打倒
  def('crouch', { defaults: { windup: 1.8, hurt: 0.25, dur: 2.4 }, name: '全屏击倒', hint: '按住 ↓ 蹲下！', survive: true,
    init(p, R, C) { return { done: false, marks: [{ x: Math.round(C.W / 2), y: Math.round(C.D / 2), w: C.W, h: C.D, r: 0, col: '#ff4a4a', label: '蹲下！', on: true, shape: 'tile' }] }; },
    on(st, p, ev) { if (ev.k === 'pos') P(st)[ev.who] = { crouch: !!ev.crouch, z: ev.z || 0 }; },
    tick(st, p) {
      if (st.done || st.t < p.windup) return; st.done = true; st.marks[0].on = false; let bad = 0;
      for (const w in P(st)) { const q = st.pl[w]; if (!q.crouch || q.z > 4) { bad++; hurt(st, w, p.hurt, 'crouch', true); } }
      st.res = bad ? 'fail' : 'solve';
    } });

  // 谜题实例：{ id, p, t, res, out, ...状态 }。普通 / 引导模式：引导模式挨打 ×0.5、时限 ×1.25
  function scaleP(p, mode) { if (mode !== 'guide') return p; const q = { ...p }; if (q.hurt) q.hurt *= 0.5; if (q.dur) q.dur *= 1.25; return q; }
  function puzNew(spec, R, C) {
    const D = PUZ[spec.use]; if (!D) throw new Error('raid_mech: 没有谜题 ' + spec.use);
    const p = scaleP({ ...D.defaults, ...spec }, C.mode);
    const st = { id: spec.use, name: spec.name || D.name, hint: spec.hint || D.hint, p, t: 0, res: null, out: [], ...D.init(p, R, C) };
    if (st.out0) { st.out.push(...st.out0); delete st.out0; }
    return st;
  }
  function puzEv(st, ev) { if (!st.res) PUZ[st.id].on(st, st.p, ev); }
  function puzTick(st, dt, R, C) {
    const D = PUZ[st.id]; if (st.ended) return;
    if (!st.res) { st.t += dt; if (D.tick) D.tick(st, st.p, dt, R, C); if (!st.res && st.p.dur && st.t >= st.p.dur) st.res = D.survive ? 'solve' : 'fail'; }
    if (st.res) { st.ended = true; if (D.onEnd) D.onEnd(st, st.p); }
  }
  const puzText = st => { const D = PUZ[st.id]; return D.text ? D.text(st, st.p) : ''; };
  const drain = st => { const o = st.out; st.out = []; return o; };

  /* ---------------- 领主脚本 ---------------- */
  // spec：{ intro: { dur, say }, loop: [招式 id], gap: [a, b], weak: { at: [血量门槛] | every: 秒, pool: [谜题 spec], pick: 'cycle' | 'random' },
  //         cast: { dur, name, say }, onSolve: { dur, mul, say }, onFail: { frac, down, say }, atk: [{ every: [a, b], puzzle: 谜题 spec, first }], lines: { intro, cast, solve, fail, low } }
  const SCRIPT_DEF = { intro: { dur: 2.5 }, gap: [2.2, 3.2], cast: { name: '读条' }, onSolve: { dur: 8, mul: 1.5 }, onFail: { frac: 1, down: true }, guide: { wipe: 0.3 } };
  function scriptNew(spec, seed, C) {
    const R = rng(seed), S = { spec: { ...SCRIPT_DEF, ...spec }, C: { W: 1400, D: 196, mode: 'normal', players: ['me'], ...C }, R, t: 0, ph: 'intro', phT: 0, weakI: 0, pickI: 0, used: [], cast: null, side: [], loopI: 0, loopT: 0, wT: 0, out: [], hp: 1, stat: { solve: 0, fail: 0, casts: 0 } };
    S.loopT = range(S.spec.gap, R);
    S.atkT = (S.spec.atk || []).map(a => a.first ?? range(a.every, R));
    const intro = S.spec.intro || {}; S.out.push({ k: 'invul', on: true }); if (intro.say) S.out.push({ k: 'say', text: intro.say, col: '#ffd8a0' });
    if (S.spec.lines && S.spec.lines.intro) S.out.push({ k: 'line', id: 'intro', text: S.spec.lines.intro });
    return S;
  }
  const range = (v, R) => (Array.isArray(v) ? v[0] + (v[1] - v[0]) * R() : +v || 0);
  function pickWeak(S) {
    const W = S.spec.weak, pool = W.pool; if (!pool || !pool.length) return null;
    if (W.pick === 'random') { let left = pool.map((_, i) => i).filter(i => !S.used.includes(i)); if (!left.length) { S.used = []; left = pool.map((_, i) => i); } const i = left[Math.floor(S.R() * left.length)]; S.used.push(i); return pool[i]; }
    return pool[S.pickI++ % pool.length];
  }
  function startCast(S) {
    const pz = pickWeak(S); if (!pz) return;
    S.cast = puzNew(pz, S.R, S.C); S.ph = 'cast'; S.phT = 0; S.stat.casts++;
    const c = S.spec.cast || {}; S.out.push({ k: 'cast', id: S.cast.id, name: c.name || S.cast.name, dur: S.cast.p.dur || 0, puzzle: S.cast.name, hint: S.cast.hint });
    if (c.say) S.out.push({ k: 'say', text: c.say, col: '#ff9a7a' });
    if (S.spec.lines && S.spec.lines.cast) S.out.push({ k: 'line', id: 'cast', text: S.spec.lines.cast });
  }
  function endCast(S) {
    const ok = S.cast.res === 'solve', L = S.spec.lines || {}; S.out.push(...drain(S.cast));
    S.out.push({ k: ok ? 'solve' : 'fail', id: S.cast.id });
    if (ok) { S.stat.solve++; const b = S.spec.onSolve; S.out.push({ k: 'break', dur: b.dur, mul: b.mul }); if (b.say) S.out.push({ k: 'say', text: b.say, col: '#8aff9a' }); if (L.solve) S.out.push({ k: 'line', id: 'solve', text: L.solve }); S.ph = 'break'; }
    else { S.stat.fail++; const f = S.spec.onFail; const frac = S.C.mode === 'guide' ? Math.min(f.frac, S.spec.guide.wipe) : f.frac; S.out.push({ k: 'wipe', frac, down: !!f.down }); if (f.say) S.out.push({ k: 'say', text: f.say, col: '#ff6a6a' }); if (L.fail) S.out.push({ k: 'line', id: 'fail', text: L.fail }); S.ph = 'fight'; }
    S.phT = 0; S.lastCast = S.cast; S.cast = null;
  }
  // io：{ hp: 0~1, ev: [...] }；返回 out 事件
  function scriptTick(S, dt, io = {}) {
    const ev = io.ev || []; S.t += dt; S.phT += dt; if (io.hp != null) S.hp = io.hp;
    for (const e of ev) { if (S.cast) puzEv(S.cast, e); for (const s of S.side) puzEv(s, e); }
    // 定时机制招（不影响虚弱 / 灭团，只按各自的挨打结算）
    if (S.ph === 'fight' || S.ph === 'cast') (S.spec.atk || []).forEach((a, i) => { S.atkT[i] -= dt; if (S.atkT[i] <= 0 && !S.side.some(s => s.atk === i)) { S.atkT[i] = range(a.every, S.R); const s = puzNew(a.puzzle, S.R, S.C); s.atk = i; S.side.push(s); S.out.push({ k: 'atk', id: s.id, name: s.name, hint: s.hint }); } });
    for (const s of S.side) { puzTick(s, dt, S.R, S.C); S.out.push(...drain(s)); }
    S.side = S.side.filter(s => !s.res);
    if (S.ph === 'intro') { if (S.phT >= (S.spec.intro.dur || 0)) { S.ph = 'fight'; S.phT = 0; S.out.push({ k: 'invul', on: false }); } }
    else if (S.ph === 'fight') {
      const W = S.spec.weak;
      if (W && W.at && S.weakI < W.at.length && S.hp <= W.at[S.weakI]) { S.weakI++; startCast(S); }
      else if (W && W.every) { S.wT += dt; if (S.wT >= W.every) { S.wT = 0; startCast(S); } }
      if (S.ph === 'fight' && S.spec.loop && S.spec.loop.length) { S.loopT -= dt; if (S.loopT <= 0) { S.loopT = range(S.spec.gap, S.R); S.out.push({ k: 'skill', id: S.spec.loop[S.loopI++ % S.spec.loop.length] }); } }
      if (S.spec.lines && S.spec.lines.low && !S.lowSaid && S.hp <= 0.2) { S.lowSaid = true; S.out.push({ k: 'line', id: 'low', text: S.spec.lines.low }); }
    } else if (S.ph === 'cast') { puzTick(S.cast, dt, S.R, S.C); S.out.push(...drain(S.cast)); if (S.cast.res) endCast(S); }
    else if (S.ph === 'break') { if (S.phT >= S.spec.onSolve.dur) { S.ph = 'fight'; S.phT = 0; S.out.push({ k: 'unbreak' }); } }
    const o = S.out; S.out = []; return o;
  }
  const view = S => ({ ph: S.ph, t: +S.t.toFixed(2), phT: +S.phT.toFixed(2), cast: S.cast && { id: S.cast.id, t: S.cast.t, dur: S.cast.p.dur, name: S.cast.name, hint: S.cast.hint, text: puzText(S.cast) }, side: S.side.map(s => ({ id: s.id, t: s.t, name: s.name, hint: s.hint, text: puzText(s) })) });

  return { rng, shuffle, gdist, ELEM, STATUS, stAdd, stTick, stHas, stN, stDel, PUZ, puzNew, puzEv, puzTick, puzText, drain, scriptNew, scriptTick, view, SCRIPT_DEF };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = RAID_MECH;
