/* =====================================================================
   团本界面（RA2，docs/RAID_PLAN.md §4.1 / §4.2）：逻辑在 net/raid.js（raidNet）
   - 入口：暗黑城的阿甘左加一个服务「团本」→ 团本窗口（w_raid）：团本列表、每天 / 每周次数、建团 / 加入 / 准备 / 开始、练习说明
   - 攻坚情况板（w_raidboard，城镇里按 R 或点顶上的团本条）：节点图（锁定 / 可进 / 战斗中 / 等另一边 / 通关 / 重生 / 关闭）、
     两个人在哪、阶段计时、全团复活次数、跨节点效果；点节点 → 单独进 / 一起进 / 标记给队友；手机上是全屏页
   - 局内 HUD（画在 UI 画布左上，组队时在队伍血条下面）：阶段剩余时间、复活次数、队友在哪 / 领主血量、同步窗口 / 镜子倒数、这个节点身上的效果、跨节点提示
   - 阶段结算（w_raidres）：用时 / 死亡 / 惩罚，领奖（raid:claim）后翻牌
   ===================================================================== */
addStyle(`
.rbwin{max-width:96%}
.rbwin .bd{display:flex;flex-direction:column;gap:.5em}
.rbtop{display:flex;flex-wrap:wrap;align-items:center;gap:.35em .8em;padding:.4em .7em;border-radius:.3em;background:linear-gradient(90deg,rgba(70,24,120,.6),rgba(16,8,26,.7));border:.08em solid #6a3aa0;font-size:.9em}
.rbtop .ph{font-weight:900;color:#f0d0ff;font-size:1.1em}
.rbtop .cd{font:900 1.35em "Arial Black",Impact,sans-serif;color:#fff2c0;letter-spacing:.03em}
.rbtop .cd.warn{color:#ff8a7a}
.rbtop .chip{padding:.1em .5em;border-radius:1em;background:rgba(0,0,0,.35);border:.07em solid #5a3a7a;color:#e0d0f0;white-space:nowrap}
.rbtop .chip.bf{border-color:#c88aff;color:#ffe0ff}
.rbtop .chip b{color:#ffcf5a}
.rbgrid{display:grid;grid-template-columns:minmax(0,1fr) 15.5em;gap:.6em;align-items:start}
.rbmap{position:relative;aspect-ratio:16/9;border-radius:.4em;overflow:hidden;border:.1em solid #4a2a6a;
  background:radial-gradient(ellipse at 50% 120%,rgba(120,40,170,.45),rgba(10,6,18,0) 60%),radial-gradient(ellipse at 10% 0%,rgba(60,30,110,.5),rgba(10,6,18,0) 50%),repeating-linear-gradient(0deg,rgba(255,255,255,.025) 0 1px,transparent 1px 2.2em),repeating-linear-gradient(90deg,rgba(255,255,255,.025) 0 1px,transparent 1px 2.2em),#0e0916}
.rbmap svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1}
.rbmap .band{position:absolute;top:0;bottom:0;border-right:.06em dashed rgba(200,160,255,.14)}.rbmap .band.odd{background:rgba(255,255,255,.025)}.rbmap .band:last-of-type{border-right:0}
.rbmap .area{position:absolute;top:.35em;transform:translateX(-50%);font-size:.72em;font-weight:900;color:rgba(220,190,255,.55);letter-spacing:.15em;white-space:nowrap}
.rbnode{position:absolute;z-index:2;transform:translate(-50%,-50%);width:8.2em;padding:.3em .3em .35em;border-radius:.45em;text-align:center;cursor:pointer;background:rgba(18,12,26,.92);border:.12em solid #6a6470;color:#cfc6d8;transition:transform .12s,box-shadow .12s;user-select:none}
.rbnode:hover{transform:translate(-50%,-50%) scale(1.05)}
.rbnode .ic{position:absolute;left:-.55em;top:-.55em;width:1.6em;height:1.6em;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.8em;font-weight:900;background:#2a2234;border:.1em solid currentColor}
.rbnode .nm{font-weight:900;font-size:.92em;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rbnode .sub{font-size:.72em;opacity:.9;white-space:nowrap}
.rbnode .who{display:flex;gap:.2em;justify-content:center;margin-top:.15em;min-height:0}
.rbnode .who span{font-size:.66em;padding:0 .35em;border-radius:.6em;background:#ffcf5a;color:#2a1a00;font-weight:900;max-width:5.5em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rbnode .who span.me{background:#9ad8ff}
.rbnode .big{font:900 1.05em "Arial Black",sans-serif;color:#fff2c0}
.rbnode.st-locked{opacity:.55;border-style:dashed}
.rbnode.st-open{border-color:#f4ecff;color:#fff;box-shadow:0 0 .7em rgba(230,210,255,.35)}
.rbnode.st-busy{border-color:#ffcf5a;color:#ffe8a8;box-shadow:0 0 .9em rgba(255,200,80,.45)}
.rbnode.st-down{border-color:#ff9a4a;color:#ffc8a0;animation:rbpulse .7s ease-in-out infinite alternate}
.rbnode.st-cleared{border-color:#7de08a;color:#b8f0c0;background:rgba(14,30,18,.92)}
.rbnode.st-cool{border-color:#8ac8ff;color:#c8e4ff}
.rbnode.st-off{opacity:.35}
.rbnode.sel{outline:.14em solid #fff;outline-offset:.12em}
.rbnode.mark::after{content:'★ 标记';position:absolute;right:-.4em;top:-.8em;font-size:.62em;font-weight:900;color:#2a1a00;background:#ffe070;border-radius:.5em;padding:0 .35em}
.rbnode.ty-final{width:8.6em;border-width:.16em}
@keyframes rbpulse{to{box-shadow:0 0 1.4em rgba(255,140,60,.8)}}
.rbside{display:flex;flex-direction:column;gap:.45em;min-width:0}
.rbbox{padding:.45em .55em;border-radius:.3em;background:rgba(0,0,0,.28);border:.07em solid #3a2a4a;font-size:.86em}
.rbbox .lbl{font-size:.8em;color:#c8a870;font-weight:900;margin-bottom:.25em}
.rbmem{display:flex;align-items:center;gap:.4em;padding:.2em 0}
.rbmem .av{flex:none;width:1.9em;height:1.9em;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;background:#3a2a50;color:#f0d8ff;border:.08em solid #8a5ac8}
.rbmem.off{opacity:.5}
.rbmem .nm{font-weight:900;color:#ffe8a8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rbmem .st{font-size:.82em;color:#c8d8e8}
.rbfeed{max-height:9.5em;overflow-y:auto;display:flex;flex-direction:column;gap:.15em}
.rbfeed div{font-size:.84em;line-height:1.3}
.rbfeed .tm{color:#8a7a9a;margin-right:.35em;font-size:.85em}
.rbnd .hd2{display:flex;align-items:center;gap:.4em;font-weight:900;color:#f0d8ff}
.rbnd .rule{color:#d8c8e8;line-height:1.4;margin:.25em 0}
.rbnd .why{color:#ffb08a;font-size:.9em;margin-top:.25em}
.rbnd .btns{display:flex;flex-wrap:wrap;gap:.35em;margin-top:.35em}
.rbbar{display:flex;flex-wrap:wrap;gap:.45em;justify-content:flex-end;align-items:center}
.rbbar .sp{flex:1}
.rbbanner{padding:.5em .7em;border-radius:.3em;font-weight:900;text-align:center}
.rbbanner.ok{background:rgba(40,110,60,.45);color:#b8ffc8;border:.08em solid #5ac878}
.rbbanner.bad{background:rgba(120,30,30,.45);color:#ffc0b0;border:.08em solid #c85a5a}
.rbbanner.rest{background:rgba(40,70,120,.45);color:#c8e0ff;border:.08em solid #5a8ac8}
.rblobby{display:flex;flex-direction:column;gap:.45em}
.rblobby .row2{display:flex;align-items:center;gap:.5em;padding:.3em .5em;border-radius:.25em;background:rgba(255,255,255,.04)}
.rblobby .rd{margin-left:auto;font-size:.85em;font-weight:900}
.rwin .rcard{padding:.6em .8em;border-radius:.35em;background:radial-gradient(ellipse at 90% 0%,rgba(150,50,220,.35),rgba(12,8,18,.95) 60%);border:.1em solid #5a2a7a;display:flex;flex-direction:column;gap:.35em}
.rwin .rcard .nm{font-weight:900;font-size:1.2em;color:#f0c8ff}
.rwin .rcard .sub{font-size:.84em;color:#c8b0d8;line-height:1.45}
.rwin .rcard .lim b{color:#ffcf5a}
.rwin .rbtns{display:flex;flex-wrap:wrap;gap:.45em}
.rwin .rnote{font-size:.82em;color:#ffd0a0;line-height:1.4}
.rreswin .cards{grid-template-columns:repeat(var(--n,2),8.5em);justify-content:center}
.rreswin .card .f b{font-size:.9em}
.rreswin .stats{display:flex;flex-wrap:wrap;gap:1em;justify-content:center;font-size:.95em}
.rreswin .stats b{color:#ffe8a8}
#raidpill[hidden]{display:none}
#raidpill{position:absolute;left:50%;top:calc(var(--u) * 10px);transform:translateX(-50%);display:flex;align-items:center;gap:.6em;padding:.25em .9em;border-radius:1.2em;background:rgba(20,10,32,.82);border:.08em solid #9a6ad8;color:#f0dcff;font-size:.85em;font-weight:800;cursor:pointer;z-index:2;white-space:nowrap;box-shadow:0 0 .8em rgba(150,90,230,.4)}
#raidpill:hover{border-color:#e0b0ff}
#raidpill .cd{font-family:"Arial Black",sans-serif;color:#fff2c0}
#raidpill kbd{font:inherit;font-size:.8em;padding:0 .35em;border-radius:.2em;background:#3a2a50;color:#d8c0ff}
@media (max-width:760px){.rbgrid{grid-template-columns:1fr}.rbnode{width:6.2em;font-size:.9em}}
:is(body.touchui,body.smallui) .rbwin{width:96%!important;max-height:94%;display:flex;flex-direction:column}
:is(body.touchui,body.smallui) .rbwin>.bd{overflow-y:auto;min-height:0}
:is(body.touchui,body.smallui) .rbgrid{grid-template-columns:1fr}
:is(body.touchui,body.smallui) .rbmap{aspect-ratio:2.3/1}
:is(body.touchui,body.smallui) .rbnode{width:6.6em;padding:.2em}
:is(body.touchui,body.smallui) .rbfeed{max-height:5.5em}
`);
const RAID_TYPE = { main: ['主', '主线'], buff: ['增', '增益'], timer: ['时', '倒计时'], order: ['序', '顺序击杀'], sync: ['双', '同步击杀'], final: ['终', '最终合流'] };
const RAID_ST = { locked: '未开放', open: '可进入', busy: '战斗中', down: '等另一边', cleared: '已通关', cool: '重生中', off: '已关闭' };
const RAID_AREA = { siroco: { 1: ['法则之境', '知性之境', '苦难之境 I', '苦难之境 II'], 2: ['第三层 · 潜意识', '第二层 · 意识', '第一层 · 棺'] } };
const raidFmt = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const raidCd = (until, cls) => h('span', { class: cls || '', 'data-cd': String(until || 0) }, raidFmt((until || 0) - raidNet.now()));
// 门槛：Lv60 + 希洛克主线（RAID_PLAN §4.1）；服务端只查等级
function raidReq() {
  const D = RAID_DEFS.siroco;
  if (game.lvl < D.minLvl) return `Lv.${D.minLvl} 才能参加团本`;
  const qs = Object.keys(QUESTS).filter(id => /^q_si\d+$/.test(id)).sort(), last = qs[qs.length - 1];
  if (last && questState(last) !== 'done') return `先完成希洛克主线（最后一步「${QUESTS[last].name}」）`;
  return null;
}
function raidBuffText(b) {
  for (const P of RAID_DEFS.siroco.phases) for (const nd of Object.values(P.nodes)) for (const f of (nd.fx && nd.fx.clear) || []) if (f.id === b.id && f.text) return f.text.replace(/（\d+ 秒）$/, '');
  if (b.id === 'twin_guard') return '血量差太大：减伤 50%';
  const p = b.p || {}; return [p.dmgTaken ? `受伤 ×${p.dmgTaken}` : '', p.noCharm ? '魅惑无效' : ''].filter(Boolean).join('、') || b.id;
}
function raidBossName(nd) {
  const real = DUNGEONS[nd.dg], base = real && real.raidFallback ? DUNGEONS[real.raidFallback] : real && !real.raid ? real : DUNGEONS[RAID_FALLBACK_DG[nd.dg]];
  const tmp = base && (!real || real.raidFallback) ? `（暂用「${base.name}」的领主 ${MON[base.boss.kind] ? MON[base.boss.kind].name : ''}）` : '';
  const nm = { gatekeeper: '无名守门人', haniel: '魅惑之哈妮尔', lena: '狙击手莱娜', gusty: '贪食的古斯提', grumi: '漂流的古鲁米', vita: '慈悲之维塔', nex: '公义之奈克斯', siroNightmare: '希洛克的噩梦', siroPhantom: '希洛克的幻影', crone: '梦中老妪', siroco: '希洛克' }[nd.boss] || (MON[nd.boss] && MON[nd.boss].name) || nd.boss || '';
  return nm + tmp;
}
function raidRuleText(nd) {
  const f = nd.fx || {}, T = nd.type;
  if (T === 'order') return '顺序击杀：两个人各打一张。头顶数字小的一边先打倒，错了两边的守门人都回满血。';
  if (T === 'sync') return `同步击杀：一边倒下后 ${nd.window || 30} 秒内另一边也要倒，不然会以 ${Math.round((nd.revive || 0.5) * 100)}% 血复活；两边血量差超过 ${Math.round((nd.diff || 0.25) * 100)}% 时血多的一边减伤。`;
  if (T === 'buff') return `增益：通关 → ${(f.clear || []).map(x => x.text).join('；')}；${nd.respawn || 120} 秒后重生，可以反复打。`;
  if (T === 'timer') return `倒计时 ${raidFmt((nd.timer || 240) * 1000)}：没人压住，到 0 → ${(f.expire || []).map(x => x.text).join('、')}；通关后修复 ${nd.repair || 90} 秒再重新计时。`;
  if (T === 'final') return '最终领主：普通模式里两个人一起进（队长带队，组队房间）；主机每 3 秒存档，房间断了从存档点接着打。';
  return '主线节点：打通才开放下一层。';
}
// 这个节点现在能不能进（只是界面提示，最后以服务端为准）
function raidCan(id) {
  const S = raidNet.S, nd = raidNet.node(id), N = S && S.nodes[id], me = raidNet.mine(), M = raidNet.mate(), t = raidNet.now();
  if (!nd || !N || !me) return { why: '' };
  if (S.st !== 'routes' && S.st !== 'final') return { why: S.st === 'rest' ? '休整中：等下一阶段开始' : S.st === 'lobby' ? '团本还没开始' : '团本已经结束了' };
  if (me.at !== 'camp') return { why: me.at === id ? '你正在这个节点里' : '你正在别的节点里' };
  if (me.ero > t) return { why: `被侵蚀了：还要 ${Math.ceil((me.ero - t) / 1000)} 秒才能进节点` };
  if (N.st !== 'open') return { why: { locked: '还没开放：先通关前面的节点', busy: '有人在打', down: '有人在打', cool: '正在重生', cleared: '已经通关了', off: '已经关闭了' }[N.st] || '' };
  const mateOn = !!(M && M.online && !M.left), party = !raidNet.local() && typeof netParty !== 'undefined' && netParty.isLeader() && M && netParty.has(M.uid);
  const needT = nd.together && S.graph === 'normal' && !S.sub && mateOn;
  const canT = !nd.solo && mateOn && M.at === 'camp' && !(M.ero > t) && !!party;
  let why = null;
  if (needT && !canT) why = !party ? '最终战要两个人一起进：等队长带队（队长点“一起进”）' : `等 ${M.name} 回到营地再一起进`;
  else if (nd.solo && mateOn) why = `必须分头打${M.at !== 'camp' ? `（${M.name} 在「${(raidNet.node(M.at) || {}).name || '别的节点'}」）` : ''}`;
  return { solo: !needT, together: canT, why };
}
const raidUi = {
  sel: null, flipped: {}, flipAsked: {}, flipClosing: {},
  refresh() {
    if (this.rq) return;
    this.rq = requestAnimationFrame(() => { this.rq = 0; for (const n of ['raidboard', 'raid', 'raidres']) if (menus.isOpen(n)) menus.refresh(n); });
  },
  // 回到营地 / 阶段完成：自动打开情况板和结算
  auto() {
    if (game.scene !== 'town' || !game.player || menus.isOpen('result') || menus.isOpen('npc')) return;
    if (raidNet.back) { raidNet.back = false; this.sel = null; if (raidNet.S) menus.show('raidboard'); }
    const C = raidNet.ctx;
    if (raidNet.resultDue && raidNet.S && !(C && !C.done)) { const ph = raidNet.resultDue; raidNet.resultDue = 0; if (!menus.isOpen('raidres')) menus.open('raidres', ph); }
  },
  top() {
    const S = raidNet.S, D = raidNet.def(), P = raidNet.phase(), L = raidNet.limits, t = raidNet.now();
    const live = S.st === 'routes' || S.st === 'final', maxL = (D.lives || {})[S.mode] || 6;
    const ph = { lobby: '大厅', rest: '休整', cleared: '团本通关', failed: '团本失败' }[S.st] || (P ? P.name : '');
    const cd = live ? raidCd(S.deadline, 'cd' + (S.deadline - t < 180000 ? ' warn' : '')) : S.st === 'rest' ? raidCd(S.restUntil, 'cd') : null;
    const mode = S.mode === 'guide' ? '引导（单人）' : S.graph === 'guide' ? '普通 · 单人' : '普通 · 2 人';
    return h('div', { class: 'rbtop' }, h('span', { class: 'ph' }, ph), cd,
      live || S.st === 'rest' ? h('span', { class: 'chip' }, '全团复活 ', h('b', {}, `${S.lives}/${maxL}`)) : null,
      h('span', { class: 'chip' }, mode, S.sub ? ' · 补位中' : ''),
      L ? h('span', { class: 'chip' }, `今天剩 ${L.dayLeft}/${L.max.day} · 本周剩 ${L.weekLeft}/${L.max.week}`) : null,
      ...(S.buffs || []).filter(b => !b.until || b.until > t).map(b => h('span', { class: 'chip bf' }, `${(raidNet.node(b.node) || {}).name || ''}：${raidBuffText(b)} `, b.until ? raidCd(b.until) : null)));
  },
  map() {
    const S = raidNet.S, P = raidNet.phase(); if (!P) return h('div', { class: 'rbmap' });
    const me = raidNet.me(), svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 160 90'); svg.setAttribute('preserveAspectRatio', 'none');
    const line = (a, b, col, dash) => { const l = document.createElementNS('http://www.w3.org/2000/svg', 'line'); const [x1, y1] = a.pos, [x2, y2] = b.pos; Object.entries({ x1: x1 * 160, y1: y1 * 90, x2: x2 * 160, y2: y2 * 90, stroke: col, 'stroke-width': dash ? 0.5 : 0.8, 'stroke-dasharray': dash ? '1.6 1.2' : '', 'stroke-linecap': 'round' }).forEach(([k, v]) => l.setAttribute(k, v)); svg.append(l); };
    for (const nd of Object.values(P.nodes)) {
      for (const n0 of nd.need) { const a = P.nodes[n0]; if (a) line(a, nd, S.nodes[n0] && S.nodes[n0].st === 'cleared' ? 'rgba(125,224,138,.75)' : 'rgba(200,180,230,.35)'); }
      for (const f of [...((nd.fx && nd.fx.clear) || []), ...((nd.fx && nd.fx.expire) || [])]) if (f.to && P.nodes[f.to]) line(nd, P.nodes[f.to], f.kind === 'heal' ? 'rgba(255,120,110,.6)' : 'rgba(210,140,255,.7)', true);
    }
    const map = h('div', { class: 'rbmap' }, svg);
    const areas = RAID_AREA[S.raid] && RAID_AREA[S.raid][P.id], xs = {};
    for (const nd of Object.values(P.nodes)) (xs[nd.area] = xs[nd.area] || []).push(nd.pos[0]);
    const cx = Object.keys(xs).sort((a, b) => a - b).map(a => [a, xs[a].reduce((s, x) => s + x, 0) / xs[a].length]);
    cx.forEach(([a, x], i) => {
      const l = i ? (cx[i - 1][1] + x) / 2 : 0, r = i < cx.length - 1 ? (cx[i + 1][1] + x) / 2 : 1;
      map.append(h('div', { class: 'band' + (i % 2 ? ' odd' : ''), style: `left:${(l * 100).toFixed(2)}%;width:${((r - l) * 100).toFixed(2)}%` }));
      if (areas) map.append(h('div', { class: 'area', style: `left:${(x * 100).toFixed(1)}%` }, areas[a - 1] || ''));
    });
    for (const nd of Object.values(P.nodes)) {
      const N = S.nodes[nd.id]; if (!N) continue;
      const [ic] = RAID_TYPE[nd.type] || ['?'], who = S.members.filter(m => !m.left && m.at === nd.id);
      let sub = RAID_ST[N.st] || N.st, big = null;
      if (N.st === 'busy' || N.st === 'down') sub = `${RAID_ST[N.st]} · ${Math.round((N.hp ?? 1) * 100)}%`;
      if (N.st === 'cool' && N.until) sub = [nd.type === 'timer' ? '修复中 ' : '重生 ', raidCd(N.until)];
      if (nd.type === 'timer' && N.timer && (N.st === 'open' || N.st === 'busy')) big = raidCd(N.timer, 'big');
      else if (nd.type === 'timer' && (N.st === 'open' || N.st === 'busy') && S.sub) big = h('span', { class: 'big' }, '暂停');
      const order = nd.type === 'order' && N.order ? ` · 顺序 ${N.order}` : '';
      const cls = `rbnode st-${N.st} ty-${nd.type}${this.sel === nd.id ? ' sel' : ''}${raidNet.markFor === nd.id || (S.marks && S.marks[me] === nd.id) ? ' mark' : ''}`;
      map.append(h('div', { class: cls, 'data-node': nd.id, style: `left:${nd.pos[0] * 100}%;top:${nd.pos[1] * 100}%`, title: RAID_TYPE[nd.type] ? RAID_TYPE[nd.type][1] : '',
        onclick: () => { sfx.click(); this.sel = this.sel === nd.id ? null : nd.id; menus.refresh('raidboard'); } },
        h('div', { class: 'ic' }, ic), h('div', { class: 'nm' }, nd.name), big, h('div', { class: 'sub' }, sub, order),
        who.length ? h('div', { class: 'who' }, who.map(m => h('span', { class: m.uid === me ? 'me' : '' }, m.uid === me ? '你' : m.name))) : null));
    }
    return map;
  },
  members() {
    const S = raidNet.S, me = raidNet.me(), t = raidNet.now();
    return h('div', { class: 'rbbox' }, h('div', { class: 'lbl' }, '队员'), S.members.filter(m => !m.left).map(m => {
      const nd = m.at !== 'camp' && raidNet.node(m.at), N = nd && S.nodes[m.at];
      const st = !m.online ? '离线' : nd ? `在「${nd.name}」${N ? ` · 领主 ${Math.round((N.hp ?? 1) * 100)}%` : ''}` : '在营地';
      const job = CLASSES[m.cls] ? (m.job && CLASSES[m.cls].jobs && CLASSES[m.cls].jobs[m.job] ? CLASSES[m.cls].jobs[m.job].name : CLASSES[m.cls].name) : '';
      return h('div', { class: 'rbmem' + (m.online ? '' : ' off') },
        h('div', { class: 'av' }, (m.name || '?').slice(0, 1)),
        h('div', { class: 'col', style: 'gap:0;min-width:0;flex:1' },
          h('span', { class: 'nm' }, S.leader === m.uid ? '♛ ' : '', m.name, m.uid === me ? '（你）' : '', h('span', { class: 'small dim' }, job ? ' ' + job : '')),
          h('span', { class: 'st' }, st, m.ero > t ? [' · 侵蚀 ', raidCd(m.ero)] : '', m.rw === false && S.st !== 'lobby' ? ' · 练习' : '', S.marks && S.marks[m.uid] ? ` · 标记：${(raidNet.node(S.marks[m.uid]) || {}).name || ''}` : '')));
    }));
  },
  feed() {
    const now = Date.now();
    return h('div', { class: 'rbbox' }, h('div', { class: 'lbl' }, '跨节点效果 / 动态'),
      h('div', { class: 'rbfeed', 'data-scroll': '1' }, raidNet.feed.length ? raidNet.feed.slice(0, 14).map(f => h('div', { style: `color:${f.col}` }, h('span', { class: 'tm' }, now - f.t < 60000 ? `${Math.max(1, Math.round((now - f.t) / 1000))} 秒前` : `${Math.round((now - f.t) / 60000)} 分钟前`), f.text)) : h('div', { class: 'dim' }, '还没有动静')));
  },
  nodeBox(id) {
    const S = raidNet.S, nd = raidNet.node(id), N = nd && S.nodes[id]; if (!nd || !N) return null;
    const c = raidCan(id), me = raidNet.me(), M = raidNet.mate(), lead = S.leader === me, [ic, tn] = RAID_TYPE[nd.type] || ['?', ''];
    const go = together => { sfx.click(); if (raidNet.enter(id, together)) toastMsg(`正在进入「${nd.name}」…`, '#e0c0ff'); };
    return h('div', { class: 'rbbox rbnd' },
      h('div', { class: 'hd2' }, h('span', { class: 'chip' }, ic), nd.name, h('span', { class: 'small dim' }, tn + (nd.solo ? ' · 必须分头' : ''))),
      h('div', { class: 'small', style: 'color:#ffd8a0' }, '领主：', raidBossName(nd)),
      h('div', { class: 'rule small' }, raidRuleText(nd)),
      h('div', { class: 'small' }, '状态：', RAID_ST[N.st] || N.st, N.by && N.by.length ? `（${N.by.map(u => (S.members.find(m => m.uid === u) || {}).name || '?').join('、')}）` : '', nd.type === 'order' && N.order ? ` · 顺序数字 ${N.order}` : ''),
      c.why ? h('div', { class: 'why' }, c.why) : null,
      h('div', { class: 'btns' },
        c.solo ? h('button', { class: 'btn', 'data-act': 'solo', onclick: () => go(false) }, '单独进') : null,
        c.together ? h('button', { class: 'btn', 'data-act': 'together', onclick: () => go(true) }, '一起进') : null,
        lead && M && !raidNet.local() && raidNet.live() ? h('button', { class: 'btn blue', onclick: () => { sfx.click(); raidNet.mark(M.uid, id); toastMsg(`已标记给 ${M.name}`, '#ffe070'); } }, '标记给队友') : null));
  },
  lobby() {
    const S = raidNet.S, me = raidNet.me(), lead = S.leader === me, mine = raidNet.mine(), D = raidNet.def();
    const act = S.members.filter(m => !m.left), block = RAID_CORE.canStart(S, me);
    const lootNames = { owner: '归属拾取', leader: '队长分配', random: '随机分配', auction: '队内竞拍' }, lootMode = S.loot && lootNames[S.loot.mode] ? S.loot.mode : 'owner';
    return h('div', { class: 'rbbox rblobby' },
      h('div', { class: 'lbl' }, `大厅 · ${S.mode === 'guide' ? '引导（单人）' : `普通（${act.length}/${D.maxPlayers || 2} 人）`}`),
      act.map(m => h('div', { class: 'row2' }, h('b', { style: 'color:#ffe8a8' }, S.leader === m.uid ? '♛ ' : '', m.name, m.uid === me ? '（你）' : ''), h('span', { class: 'small dim' }, m.online ? '' : '离线'),
        h('span', { class: 'rd', style: `color:${S.leader === m.uid || m.ready ? '#8aff9a' : '#ffb08a'}` }, S.leader === m.uid ? '团长' : m.ready ? '已准备' : '没准备'))),
      S.mode === 'normal' && act.length < 2 ? h('div', { class: 'small', style: 'color:#d8c8e8' }, '邀请一名队友进队伍，队友在阿甘左那里点“加入”；也可以直接开始：1 个人进普通 = 引导的节点、普通的数值和奖励。') : null,
      S.mode === 'normal' ? h('div', { class: 'row', style: 'gap:.45em;align-items:center' }, h('span', { class: 'small dim' }, '装备分配'), lead ? h('select', { class: 'txt', value: lootMode, onchange: ev => { const mode = ev.target.value; if (!raidNet.setLootMode(mode)) ev.target.value = lootMode; } }, Object.entries(lootNames).map(([k, v]) => h('option', { value: k }, v))) : h('span', {}, lootNames[lootMode])) : null,
      raidNet.limits && !raidNet.limits.ok ? h('div', { class: 'small', style: 'color:#ffd0a0' }, '你今天 / 本周的次数用完了：这次算练习（没有奖励、不翻牌）。') : null,
      h('div', { class: 'rbbar' },
        lead ? h('button', { class: 'btn' + (block ? ' off' : ''), 'data-act': 'start', title: block ? block.text : '', onclick: () => { if (block) { toastMsg(block.text, '#ffd0a0'); sfx.error(); return; } sfx.click(); raidNet.start(); } }, '开始团本')
          : h('button', { class: 'btn', 'data-act': 'ready', onclick: () => { sfx.click(); raidNet.ready(!(mine && mine.ready)); } }, mine && mine.ready ? '取消准备' : '准备'),
        h('button', { class: 'btn blue', onclick: () => { sfx.click(); raidNet.leave(); } }, '离开')));
  },
  bar() {
    const S = raidNet.S, me = raidNet.me(), lead = S.leader === me, mine = raidNet.mine(), rw = mine && mine.rw !== false;
    const quit = () => netAsk('raidquit', { title: '离开团本？', text: '团本开始以后离开 = 放弃，这周的次数照扣。确定离开吗？', okText: '离开', danger: true, ok: () => raidNet.leave() });
    const claimBtn = ph => rw && S.res && S.res.phases.includes(ph) ? h('button', { class: 'btn', 'data-act': 'claim' + ph, onclick: () => { sfx.click(); menus.show('raidres', ph); } }, raidNet.got(S.sid, ph) ? `${(raidNet.phase(ph) || {}).name || ''}奖励（已领）` : `领取${(raidNet.phase(ph) || {}).name || ''}奖励`) : null;
    if (S.st === 'cleared' || S.st === 'failed') return h('div', { class: 'rbbar' }, claimBtn(1), claimBtn(2), h('span', { class: 'sp' }), h('button', { class: 'btn blue', 'data-act': 'dismiss', onclick: () => { sfx.click(); if (raidNet.dismiss()) menus.close('raidboard'); } }, '关闭团本'));
    const flipReady = !S.members.some(m => m.rw !== false) || !S.flip || S.flip.state === 'closed';
    return h('div', { class: 'rbbar' }, claimBtn(1),
      S.st === 'rest' && lead ? h('button', { class: 'btn' + (flipReady ? '' : ' off'), 'data-act': 'next', onclick: () => { if (!flipReady) { toastMsg('请等全员完成翻牌后再开始下一阶段', '#ffd0a0'); return; } sfx.click(); raidNet.start(); } }, flipReady ? `现在开始${(raidNet.phase((raidNet.S.phase || 0) + 1) || {}).name || '下一阶段'}` : '等待全员翻牌') : null,
      h('span', { class: 'sp' }), h('span', { class: 'small dim' }, '城镇里按 R 开关情况板'),
      h('button', { class: 'btn red', onclick: () => { sfx.click(); quit(); } }, '离开团本'));
  },
  banner() {
    const S = raidNet.S;
    if (S.st === 'cleared') return h('div', { class: 'rbbanner ok' }, `团本通关！追逐战 ${raidFmt(S.res.used[1] || 0)} · 讨伐战 ${raidFmt(S.res.used[2] || 0)} · 全团倒下 ${S.stats.deaths} 次`);
    if (S.st === 'failed') return h('div', { class: 'rbbanner bad' }, { timeout: '超时了：团本失败（已经领的奖励保留）', abandon: '大家都离开了：团本结束', stale: '大厅太久没开始：团本解散' }[S.why] || '团本结束了');
    if (S.st === 'rest') return h('div', { class: 'rbbanner rest' }, '追逐战完成！休整结束后讨伐战自动开始（团长可以提前开始）· 剩 ', raidCd(S.restUntil));
    if (S.st === 'final') return h('div', { class: 'rbbanner rest' }, '最终领主的门开了：集合一起进「真·意识之棺」！');
    return null;
  },
};
Object.assign(menus, {
  // 团本入口（阿甘左）：团本列表、次数、建团 / 加入 / 准备 / 开始
  w_raid(npc) {
    const S = raidNet.S, L = raidNet.limits, req = raidReq(), me = raidNet.me(), inv = raidNet.invite, P = typeof netParty !== 'undefined' && !raidNet.local() ? netParty.p : null;
    if ((!L || Date.now() - (raidNet.limitsT || 0) > 30000) && !this._raidFetching) { raidNet.limitsT = Date.now(); this._raidFetching = true; raidNet.fetch().finally(() => { this._raidFetching = false; }); }
    const body = h('div', { class: 'col', style: 'gap:.55em' });
    for (const D of Object.values(RAID_DEFS)) {
      const lim = L ? h('div', { class: 'sub lim' }, '今天剩 ', h('b', {}, `${L.dayLeft}/${L.max.day}`), ' · 本周剩 ', h('b', {}, `${L.weekLeft}/${L.max.week}`),
        ` · 每天 06:00 / 每周四 06:00 重置（下次 ${new Date(L.nextWeek).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', weekday: 'short' })}）`) : h('div', { class: 'sub' }, '正在查询次数…');
      const card = h('div', { class: 'rcard', 'data-raid': D.id },
        h('div', { class: 'nm' }, D.name, h('span', { class: 'small dim', style: 'margin-left:.6em' }, `Lv.${D.minLvl} · 1~${D.maxPlayers || 2} 人`)),
        h('div', { class: 'sub' }, '希洛克的幻界：攻坚地图上分头打节点，互相影响（顺序击杀、增益、倒计时、双生同步），最后两个人一起讨伐希洛克。两个阶段：追逐战 25 分钟 / 讨伐战 20 分钟（引导 40 / 30 分钟）。'),
        lim,
        L && !L.ok ? h('div', { class: 'rnote' }, '次数用完了也能进：这次算练习——没有奖励、不翻牌。') : null,
        req ? h('div', { class: 'rnote', style: 'color:#ff9a8a' }, req) : null);
      if (!raidNet.live()) {
        const busyP = P && P.members.length > (D.maxPlayers || 2), notLead = P && P.leader !== me;
        card.append(h('div', { class: 'rbtns' },
          h('button', { class: 'btn' + (req || raidNet.local() || busyP || notLead ? ' off' : ''), 'data-act': 'normal', onclick: () => {
            if (req || raidNet.local() || busyP || notLead) { toastMsg(req || (raidNet.local() ? '没有登录：只能单人引导' : busyP ? `当前团本最多 ${D.maxPlayers || 2} 人` : '只有队长可以建团'), '#ffd0a0'); sfx.error(); return; }
            sfx.click(); raidNet.create('normal'); } }, '建团（普通）'),
          h('button', { class: 'btn blue' + (req ? ' off' : ''), 'data-act': 'guide', onclick: () => { if (req) { toastMsg(req, '#ffd0a0'); sfx.error(); return; } sfx.click(); raidNet.create('guide'); } }, '单人引导'),
          inv ? h('button', { class: 'btn' + (req ? ' off' : ''), 'data-act': 'join', onclick: () => { if (req) { toastMsg(req, '#ffd0a0'); sfx.error(); return; } sfx.click(); raidNet.join(inv.sid); } }, '加入队长的团本') : null),
          h('div', { class: 'sub' }, '普通：先组队（最多 2 人），队长建团，队友在这里点“加入”。1 个人进普通 = 引导的节点、普通的数值和奖励。', h('br'), '引导：1 个人，每层只有一个节点、机制减半，奖励 ×0.6。'),
          raidNet.local() ? h('div', { class: 'rnote' }, '没有登录：只能打单人引导，进度存在这台设备上。') : null);
      }
      body.append(card);
    }
    if (S && S.st === 'lobby') body.append(raidUi.lobby());
    else if (S) body.append(h('div', { class: 'rbbox' }, h('div', { class: 'lbl' }, raidNet.live() ? '进行中的团本' : '上一次团本'), raidUi.top(), h('div', { class: 'rbbar', style: 'margin-top:.4em' },
      h('button', { class: 'btn', 'data-act': 'board', onclick: () => { sfx.click(); this.close('raid'); menus.show('raidboard'); } }, '打开攻坚情况板'))));
    const el = this.win(`${npc && npc.name ? npc.name + ' · ' : ''}团本`, body, { w: 34 });
    el.classList.add('rwin'); el._arg = npc || null;
    return el;
  },
  // 攻坚情况板
  w_raidboard() {
    const S = raidNet.S;
    if (!S) return this.win('攻坚情况板', h('div', { class: 'col', style: 'gap:.5em' }, h('div', { class: 'dim' }, '你现在不在团本里。去暗黑城找阿甘左，选择“团本”。')), { w: 26 });
    if (raidUi.sel && !raidNet.node(raidUi.sel)) raidUi.sel = null;
    const side = h('div', { class: 'rbside' }, raidUi.sel ? raidUi.nodeBox(raidUi.sel) : h('div', { class: 'rbbox small dim' }, '点地图上的节点：看规则、进节点。'), raidUi.members(), raidUi.feed());
    const main = S.st === 'lobby' ? raidUi.lobby() : raidUi.map();
    const el = this.win(`攻坚情况板 · ${raidNet.def().name}`, h('div', { class: 'col', style: 'gap:.5em' }, raidUi.top(), raidUi.banner(), h('div', { class: 'rbgrid' }, main, side), S.st === 'lobby' ? null : raidUi.bar()), { w: 62, block: false });
    el.classList.add('rbwin');
    return el;
  },
  // 阶段结算：领奖 → 明确选择翻牌（P1 选 1 张，P2 选 2 张）
  w_raidres(ph) {
    const S = raidNet.S; if (!S) return null;
    ph = ph || (S.res.phases[S.res.phases.length - 1] || 1);
    const P = raidNet.phase(ph) || { name: '阶段' }, me = raidNet.mine(), rw = !!me && me.rw !== false, key = S.sid + ':' + ph, rew = raidNet.claims[key], D = raidNet.def();
    const n = Math.max(1, ((D.rewards || {})['p' + ph] || []).length), limit = RAID_CORE.flipLimit ? RAID_CORE.flipLimit(ph) : (ph === 1 ? 1 : 2), cards = [];
    const owed = save.data && save.data.raidOwed;
    const picks = () => raidNet.flipState && raidNet.flipState.phase === ph ? (raidNet.flipState.picks || []) : [];
    const picked = i => picks().find(x => x.index === i);
    for (let i = 0; i < n; i++) {
      const c = rew && rew.cards && rew.cards[i];
      const sel = picked(i), face = c && sel ? [h('img', { src: itemIconSrc(c.key, 64) }), h('b', { class: 'r3' }, `${raidNet.itemName(c.key)} ×${c.n}`)] : [h('span', { class: 'dim' }, c ? '?' : '—')];
      const el = h('div', { class: 'card' + (sel ? ' flip used' : ''), onclick: () => {
        if (!rew || sel) return;
        if (picks().length >= limit) { toastMsg(`本阶段只能选择 ${limit} 张牌`, '#ffd0a0'); sfx.error(); return; }
        sfx.click(); raidNet.flip('pick', ph, i);
      } }, h('div', { class: 'in' }, h('div', { class: 'b' }, sel ? '★' : '?'), h('div', { class: 'f' }, ...face)));
      cards.push(el);
    }
    if (rew && !raidUi.flipAsked[key]) { raidUi.flipAsked[key] = 1; raidNet.flip('open', ph); }
    const used = S.res.used && S.res.used[ph];
    const flipDone = raidNet.flipClosed(S.sid, ph), closing = !!raidUi.flipClosing[key];
    if (flipDone) delete raidUi.flipClosing[key];
    const body = h('div', { class: 'col', style: 'gap:.6em;align-items:center' },
      h('div', { style: 'font:900 1.6em "PingFang SC","Microsoft YaHei",serif;color:#f0d0ff' }, S.st === 'cleared' && ph === 2 ? '团本通关！' : `${P.name}完成！`),
      h('div', { class: 'stats' }, h('span', {}, '用时 ', h('b', {}, used ? raidFmt(used) : '—')), h('span', {}, '全团倒下 ', h('b', {}, S.stats.deaths)), h('span', {}, '惩罚 ', h('b', {}, S.stats.penalties)), h('span', {}, '模式 ', h('b', {}, S.mode === 'guide' ? '引导' : '普通'))),
      rw && rew ? h('div', { class: 'rnote' }, `翻牌阶段：选择 ${limit} 张牌（已选 ${picks().length}/${limit}），未完成前角色停留在结算界面。`) : null,
      rw ? h('div', { class: 'cards', style: `--n:${n}` }, cards) : h('div', { class: 'rnote', style: 'color:#ffd0a0' }, '这次是练习（本周 / 今天的次数已经用完了）：没有奖励。'),
      rew && owed && Object.keys(owed).length ? h('div', { class: 'small', style: 'color:#d8c8e8' }, `物品还没上架，先记在账上：${Object.entries(owed).map(([k, v]) => `${raidNet.itemName(k)} ×${v}`).join('、')}（团本商店开放后自动发到背包）`) : null,
      h('div', { class: 'rbbar', style: 'justify-content:center' },
        rw && !rew ? h('button', { class: 'btn big', 'data-act': 'claim', onclick: () => { sfx.click(); raidNet.claim(ph); } }, '领取奖励') : null,
        rw && rew ? h('button', { class: 'btn big blue' + (closing || picks().length < limit && !flipDone ? ' off' : ''), 'data-act': 'close', onclick: () => {
          if (closing) return;
          if (flipDone) { sfx.click(); this.close('raidres'); return; }
          if (picks().length < limit) { toastMsg(`请先选择 ${limit} 张牌`, '#ffd0a0'); return; }
          sfx.click(); raidUi.flipClosing[key] = 1;
          if (!raidNet.flip('close', ph)) delete raidUi.flipClosing[key];
          raidUi.refresh();
        } }, closing ? '正在确认翻牌…' : flipDone ? '已完成翻牌' : '完成翻牌') : h('button', { class: 'btn big blue', 'data-act': 'close', onclick: () => { sfx.click(); this.close('raidres'); } }, '关闭')));
    const el = this.win(`阶段结算 · ${P.name}`, body, { w: 30, block: true });
    el.classList.add('rreswin'); el._arg = ph;
    return el;
  },
});
NPC_SERVICES.raid = { label: '团本', run: N => menus.open('raid', N) };
if (NPCS.agonzo && !NPCS.agonzo.services.includes('raid')) NPCS.agonzo.services.push('raid');
UI_WIN.raid = 'raid'; UI_ACTIONS.add('raid');
if (typeof MB_WIN !== 'undefined') MB_WIN.raid = 'raid';
if (typeof MENUBAR !== 'undefined' && !MENUBAR.some(b => b[0] === 'raid')) {
  const i = MENUBAR.findIndex(b => b[0] === 'pvp');
  MENUBAR.splice(i >= 0 ? i : MENUBAR.length, 0, ['raid', '团本']);
}
bus.on('raidChange', () => {
  // 翻牌关闭必须等服务端回执；收到回执后再解除结算 modal 和移动锁。
  for (const key of Object.keys(raidUi.flipClosing)) {
    const i = key.lastIndexOf(':'), sid = key.slice(0, i), ph = Number(key.slice(i + 1));
    if (raidNet.flipClosed(sid, ph)) {
      delete raidUi.flipClosing[key];
      if (menus.isOpen('raidres')) menus.close('raidres');
    }
  }
  raidUi.refresh();
});
bus.on('raidFlipError', () => { raidUi.flipClosing = {}; raidUi.refresh(); });
bus.on('raidClaimed', () => raidUi.refresh());
bus.on('raidStarted', () => { if (game.scene !== 'town') return; if (menus.isOpen('raid')) menus.close('raid'); menus.show('raidboard'); });
bus.on('raidInvite', m => {
  if (game.scene !== 'town' || raidNet.S) return;
  netAsk('raidinv', { title: '团本邀请', block: false, timeout: 30000, text: `<b>${escHtml(m.leader ? m.leader.name : '队长')}</b> 建了「${escHtml((RAID_DEFS[m.raid] || RAID_DEFS.siroco).name)}」（${m.mode === 'guide' ? '引导' : '普通'}）。现在加入吗？`,
    okText: '加入', cancelText: '稍后', ok: () => { const r = raidReq(); if (r) { toastMsg(r, '#ffd0a0'); return; } raidNet.join(m.sid); } });
});
// 城镇里按 R：开关情况板（在团本里时）
addEventListener('keydown', e => {
  if (e.code !== 'KeyR' || e.repeat || isTyping() || game.scene !== 'town' || !raidNet.S) return;
  if (menus.isOpen('raidboard')) { menus.close('raidboard'); return; }
  if (menus.modal()) return;
  menus.open('raidboard');
});
// 倒数：每半秒刷新所有 data-cd
setInterval(() => {
  const t = raidNet.now();
  for (const n of ['raidboard', 'raid']) { const w = menus.wins[n]; if (w) for (const e of w.querySelectorAll('[data-cd]')) e.textContent = raidFmt(+e.dataset.cd - t); }
}, 500);
// ---- 城镇顶上的团本条（点它 / 按 R 打开情况板）----
const raidPill = {
  el: null, sig: '',
  tick() {
    const S = raidNet.S, show = !!S && game.scene === 'town' && !!game.player && ui.panelOn() && !menus.hudHidden() && !menus.isOpen('raidboard');
    if (!this.el) { this.el = h('div', { id: 'raidpill', hidden: '', onclick: () => { sfx.click(); menus.show('raidboard'); } }); dom.append(this.el); }
    if (this.el.hidden === show) this.el.hidden = !show;
    if (!show) return;
    const P = raidNet.phase(), t = raidNet.now(), live = S.st === 'routes' || S.st === 'final';
    const cd = live ? raidFmt(S.deadline - t) : S.st === 'rest' ? raidFmt(S.restUntil - t) : '';
    const txt = { lobby: '大厅', rest: '休整', cleared: '通关', failed: '结束' }[S.st] || (P ? P.name : '');
    const sig = [S.sid, txt, cd, S.lives].join('|'); if (sig === this.sig) return; this.sig = sig;
    this.el.replaceChildren(h('span', {}, '团本 · ', txt), cd ? h('span', { class: 'cd' }, cd) : null, live ? h('span', {}, `复活 ${S.lives}`) : null, h('kbd', {}, 'R'), h('span', { style: 'font-size:.85em;opacity:.8' }, '攻坚情况板'));
  },
};
{ const draw0 = ui.draw; ui.draw = function () { draw0.apply(this, arguments); raidPill.tick(); raidUi.auto(); }; }
// ---- 局内 HUD：左上一块小面板（阶段计时 / 复活 / 队友 / 同步窗口 / 镜子 / 效果 / 最新动态）；组队时排在队伍血条下面，手机上让开左边的按钮 ----
netUiHooks.push(c => {
  const C = raidNet.ctx, S = raidNet.S, dg = game.dungeon;
  if (!C || !S || !C.started || C.done || game.scene !== 'dungeon' || !dg || dg.raid !== C) return;
  const t = raidNet.now(), P = raidNet.phase(), M = raidNet.mate(), blink = Math.floor(performance.now() / 350) % 2 === 0, myNd = raidNet.node(C.node) || {};
  const rows = [];
  const sp = [];
  for (const g in S.win || {}) {
    const W = S.win[g]; if (!W || W.until <= t) continue;
    if (W.node === C.node) sp.push([`等另一边倒下 ${raidFmt(W.until - t)}`, '#ffb070']);
    else if ((raidNet.node(W.node) || {}).group === myNd.group) sp.push([`打倒它！${raidFmt(W.until - t)}`, blink ? '#ff5a4a' : '#ffe070']);
  }
  if (P) for (const nd of Object.values(P.nodes)) { const N = S.nodes[nd.id]; if (nd.type === 'timer' && N && N.timer && (N.st === 'open' || N.st === 'busy')) { const left = N.timer - t; sp.push([`${nd.name} ${raidFmt(left)}`, left < 30000 && blink ? '#ff5a4a' : '#c8e0ff']); } }
  if (C.order && C.type === 'order') sp.push([`顺序 ${C.order}${C.orderTurn ? '' : '（先等小的）'}`, C.orderTurn ? '#8aff9a' : '#ffb070']);
  if (C.practice) sp.push(['练习', '#aaa']);
  if (M) { const nd = M.at !== 'camp' && raidNet.node(M.at), N = nd && S.nodes[M.at]; rows.push([[!M.online ? `${M.name}：离线` : M.at === C.node ? `${M.name}：一起打` : nd ? `${M.name}：${nd.name} ${Math.round(((N && N.hp) ?? 1) * 100)}%` : `${M.name}：在营地`, M.online ? '#9ad8ff' : '#999']]); }
  if (sp.length) rows.push(sp);
  const bl = C.buffs.filter(b => !b.until || b.until > t);
  if (bl.length) rows.push(bl.map(b => [`${raidBuffText(b)}${b.until ? ` ${Math.ceil((b.until - t) / 1000)}秒` : ''}`, '#f0c0ff']));
  const f = raidNet.feed[0], age = f ? (Date.now() - f.t) / 1000 : 99;
  if (age < 8) rows.push([[f.text, f.col || '#e8d8ff']]);
  const x0 = document.body.classList.contains('touchui') ? 130 : 16, w = 450, coopN = typeof coop !== 'undefined' && coop.state === 'play' ? 1 + coop.mates.size : 0;
  const y0 = 150 + coopN * 60, hh = 40 + rows.length * 28;
  c.fillStyle = 'rgba(12,6,20,.66)'; c.fillRect(x0, y0, w, hh);
  c.fillStyle = 'rgba(190,140,255,.8)'; c.fillRect(x0, y0, 4, hh);
  const live = S.st === 'routes' || S.st === 'final';
  uiText(`${P ? P.name : '团本'} ${live ? raidFmt(S.deadline - t) : ''}`, x0 + 14, y0 + 29, { size: 24, color: live && S.deadline - t < 180000 ? '#ff8a7a' : '#fff2c0', sw: 4 });
  uiText(`全团复活 ${S.lives}`, x0 + w - 10, y0 + 28, { size: 18, align: 'right', color: S.lives > 0 ? '#ffd0e0' : '#ff8a7a', sw: 4 });
  rows.forEach((r, i) => { let x = x0 + 14; for (const [txt, col] of r) { uiText(txt, x, y0 + 58 + i * 28, { size: 17, color: col, sw: 3 }); x += uctx.measureText(txt).width + 20; } });
  if (C.held) uiText('领主倒下了——等待团本裁决（另一边 / 服务器）', 960, 330, { size: 30, align: 'center', color: '#ffd8a0', sw: 6 });
});
