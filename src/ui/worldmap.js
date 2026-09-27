/* =====================================================================
   世界地图（窗口名 worldmap，快捷键 N 由界面组分配）
   - 按场景的 map 坐标画出各城镇 / 区域和它们之间的道路，标出当前位置
   - 点一个地点：右侧列出这里的 NPC、地下城（推荐等级、隐藏地下城是否已出现、是否通关过）
   - 区域移动（官方：赫顿玛尔的诺羽、西海岸的马琳）：去过的城镇可以直接传送
       通过区域移动 NPC 打开（{ travel: true }）→ 任何地方都能传；按 N 打开 → 只有站在城镇里时能传
   ===================================================================== */
NPC_SERVICES.travel ??= { label: '区域移动', run: N => menus.open('worldmap', { travel: true, npc: N }) };
const WORLDMAP_H = 68;   // 地图坐标的纵向范围（横向 0~100）
const REGION_COL = { 艾尔文防线: '#6fbf5a', 赫顿玛尔: '#e6c35c', 西海岸: '#5ab4e6', 洛兰: '#4fae8a', 格兰之森: '#8a6ad8', 天空之城: '#8ad0ff' };
// 从 from 出发，按出口的等级要求 / 是否开放，能走到的场景
function reachableScenes(from) {
  const ok = new Set([from]), q = [from];
  while (q.length) { const S = SCENES[q.shift()]; if (!S) continue; for (const ex of S.exits) if (SCENES[ex.to] && !ex.locked && !(ex.minLv && game.lvl < ex.minLv) && !ok.has(ex.to)) { ok.add(ex.to); q.push(ex.to); } }
  return ok;
}
function travelBlocked(id, arg) {
  const S = SCENES[id], here = world && world.S;
  if (game.scene !== 'town') return '只能在城镇或区域地图里使用';
  if (!S || S.kind !== 'town') return '只能传送到城镇';
  if (here && here.id === id) return '你就在这里';
  if (!(save.data.seen || {})[id]) return '还没有去过这里';
  if (!arg.travel && here && here.kind !== 'town') return '在城镇里才能传送（或找诺羽 / 马琳）';
  if (here && !reachableScenes(here.id).has(id)) return '等级不够，还不能前往';
  return '';
}
Object.assign(menus, {
  w_worldmap(arg = {}) {
    const here = world && game.scene === 'town' ? world.S.id : (save.data.loc && save.data.loc.scene);
    const seen = save.data.seen || {}, reach = here ? reachableScenes(here) : new Set();
    let sel = SCENES[this.wmSel] ? this.wmSel : here;
    const map = h('div', { class: 'wm-map' }), info = h('div', { class: 'wm-info' });
    const P = S => [S.map[0], S.map[1] / WORLDMAP_H * 100];
    // 地区的底色（按城镇名分组，把同一地区的点包起来）
    const groups = {};
    for (const id in SCENES) { const S = SCENES[id]; if (S.map) (groups[S.name] ??= []).push(S); }
    for (const name in groups) {
      const L = groups[name].map(P), x0 = Math.min(...L.map(p => p[0])), x1 = Math.max(...L.map(p => p[0])), y0 = Math.min(...L.map(p => p[1])), y1 = Math.max(...L.map(p => p[1]));
      const top = Math.max(0, y0 - 11);
      map.append(h('div', { class: 'wm-region', style: `left:${x0 - 6}%;top:${top}%;width:${x1 - x0 + 12}%;height:${y1 + 11 - top}%;--c:${REGION_COL[name] || '#c8b890'}` }, h('span', {}, name)));
    }
    // 道路
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'wm-roads'); svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('preserveAspectRatio', 'none');
    const drawn = new Set();
    for (const id in SCENES) for (const ex of SCENES[id].exits) {
      const T = SCENES[ex.to]; if (!T || !T.map || !SCENES[id].map) continue;
      const key = [id, ex.to].sort().join('|'); if (drawn.has(key)) continue; drawn.add(key);
      const [ax, ay] = P(SCENES[id]), [bx, by] = P(T), l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      l.setAttribute('x1', ax); l.setAttribute('y1', ay); l.setAttribute('x2', bx); l.setAttribute('y2', by);
      l.setAttribute('class', reach.has(id) && reach.has(ex.to) ? 'on' : 'off'); svg.append(l);
    }
    map.append(svg);
    // 地点
    for (const id in SCENES) {
      const S = SCENES[id]; if (!S.map) continue;
      const [x, y] = P(S), known = seen[id] || reach.has(id);
      const el = h('div', { class: `wm-node ${S.kind}${id === here ? ' here' : ''}${id === sel ? ' sel' : ''}${known ? '' : ' unk'}${reach.has(id) ? '' : ' lock'}`, style: `left:${x}%;top:${y}%`, 'data-id': id,
        onclick: () => { this.wmSel = id; sfx.click(); this.refresh('worldmap', arg); } },
        h('i', {}), h('b', {}, S.area && S.area !== S.name ? S.area : S.name));
      if (id === here) el.append(h('em', {}, '你在这里'));
      map.append(el);
    }
    // 右侧：选中地点的详情
    const S = SCENES[sel];
    if (S) {
      info.append(h('div', { class: 'wm-title' }, sceneTitle(S)), h('div', { class: 'small dim' }, S.kind === 'field' ? '区域地图' : S.interior ? '室内' : '城镇', reach.has(sel) ? '' : ' · 未解锁'));
      const locks = [];
      for (const id in SCENES) for (const ex of SCENES[id].exits) if (ex.to === sel && ex.minLv && game.lvl < ex.minLv) locks.push(`从${sceneTitle(SCENES[id])}进入需要 Lv.${ex.minLv}`);
      for (const m of locks) info.append(h('div', { class: 'small', style: 'color:#ffb08a' }, m));
      if (S.npcs.length) info.append(h('div', { class: 'wm-sub' }, 'NPC'), h('div', { class: 'wm-list' }, S.npcs.map(n => { const N = NPCS[n.npc]; return N ? h('div', {}, h('b', {}, N.name), h('span', { class: 'dim small' }, ' ' + (N.title || ''))) : null; })));
      const gates = S.gates.filter(g => DUNGEONS[g.dungeon]);
      if (gates.length) info.append(h('div', { class: 'wm-sub' }, '地下城'), h('div', { class: 'wm-list' }, gates.map(g => {
        const D = DUNGEONS[g.dungeon], open = dungeonUnlocked(D), lv = game.lvl, col = lv < D.lvl[0] - 1 ? '#ff8a7a' : lv > D.lvl[1] + 2 ? '#a8a8a8' : '#bfe8a0', clr = Object.keys(save.data.best || {}).some(k => k.split(':')[0] === D.id);
        return h('div', { class: 'wm-dg' + (open ? '' : ' hid') }, h('b', {}, open ? D.name : '？？？'), h('span', { style: `color:${col}` }, ` Lv.${D.lvl[0]}~${D.lvl[1]}`),
          D.hidden ? h('span', { class: 'small', style: 'color:#e0a0ff' }, open ? ' 隐藏' : ' 隐藏（未出现）') : null, clr ? h('span', { class: 'small gold' }, ' 已通关') : null);
      })));
      const ex = S.exits.filter(e => e.locked).map(e => e.label).filter(Boolean);
      if (ex.length) info.append(h('div', { class: 'wm-sub' }, '未开放'), h('div', { class: 'wm-list dim small' }, ex.join('、')));
      const why = travelBlocked(sel, arg);
      if (S.kind === 'town') info.append(h('div', { class: 'wm-go' }, h('button', { class: 'btn' + (why ? ' off' : ''), onclick: () => {
        if (why) { toastMsg(why, '#ffd0a0'); sfx.error(); return; }
        this.close('worldmap'); worldTravel(sel);
      } }, '区域移动'), why ? h('div', { class: 'small dim' }, why) : null));
    }
    const body = h('div', { class: 'wm' }, map, info);
    const el = this.win(arg.npc ? `${arg.npc.name} · 区域移动` : '世界地图', h('div', {}, body, h('div', { class: 'small dim wm-legend' }, '● 城镇　◆ 区域地图　点击地点查看详情；去过的城镇可以区域移动')), { w: 62 });
    el._arg = arg; return el;
  },
});
addStyle(`
.wm{display:flex;gap:.8em;align-items:stretch}
.wm-map{position:relative;flex:1;aspect-ratio:100/68;border-radius:.4em;overflow:hidden;border:.12em solid #8a6a3a;
  background:radial-gradient(ellipse at 30% 30%,#f6e8c4,#e4c98e 70%,#c9a868);box-shadow:inset 0 0 2.4em rgba(90,60,20,.55)}
.wm-region{position:absolute;border-radius:50%;background:radial-gradient(ellipse,color-mix(in srgb,var(--c) 42%,transparent),transparent 72%)}
.wm-region span{position:absolute;left:50%;top:.2em;transform:translateX(-50%);font-weight:900;font-size:.95em;color:#4a3214;letter-spacing:.2em;text-shadow:0 0 .3em #fff6d8;white-space:nowrap}
.wm-roads{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.wm-roads line{stroke-width:.9;stroke-linecap:round;vector-effect:non-scaling-stroke}
.wm-roads line.on{stroke:#7a5426;stroke-width:3;stroke-dasharray:6 4}.wm-roads line.off{stroke:#9a8a6a;stroke-width:2;stroke-dasharray:2 5}
.wm-node{position:absolute;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;cursor:pointer;z-index:2}
.wm-node i{width:1.05em;height:1.05em;border-radius:50%;background:radial-gradient(circle at 35% 35%,#fff6d0,#e8b44a 60%,#8a5a1a);border:.12em solid #4a2c0a;box-shadow:0 .1em .3em rgba(0,0,0,.5)}
.wm-node.field i{border-radius:.15em;transform:rotate(45deg);width:.85em;height:.85em;background:radial-gradient(circle at 35% 35%,#e8fff0,#5ab48a 60%,#1a5a3a)}
.wm-node b{margin-top:.15em;font-size:.72em;color:#3a2410;white-space:nowrap;text-shadow:0 0 .25em #fff8e0,0 0 .25em #fff8e0}
.wm-node.unk b{color:#8a7a5a}.wm-node.lock i{filter:grayscale(1) brightness(.8)}
.wm-node.sel i{outline:.14em solid #fff;outline-offset:.12em}
.wm-node.here i{animation:wmPulse 1.2s ease-in-out infinite;background:radial-gradient(circle at 35% 35%,#fff,#ff7a4a 55%,#9a2a0a)}
.wm-node em{position:absolute;bottom:100%;margin-bottom:.2em;font-style:normal;font-size:.68em;font-weight:900;color:#fff;background:#c0421a;padding:.05em .4em;border-radius:.3em;white-space:nowrap;box-shadow:0 .1em .25em rgba(0,0,0,.4)}
@keyframes wmPulse{0%,100%{box-shadow:0 0 0 0 rgba(255,120,60,.8)}50%{box-shadow:0 0 0 .5em rgba(255,120,60,0)}}
.wm-info{width:13em;display:flex;flex-direction:column;gap:.3em;font-size:.9em}
.wm-title{font-weight:900;color:var(--gold);font-size:1.15em}
.wm-sub{margin-top:.4em;color:#e8c26a;font-weight:800;border-bottom:.06em solid #5a4a36}
.wm-list{display:flex;flex-direction:column;gap:.15em;max-height:12em;overflow:auto}
.wm-dg.hid b{color:#9a8f7c}
.wm-go{margin-top:auto;display:flex;flex-direction:column;gap:.3em;padding-top:.6em}.wm-go .btn.off{filter:grayscale(.8);opacity:.7}
.wm-legend{margin-top:.5em}
`);
// 启动时的内容校验（所有内容文件都已加载，NPC 功能也都注册完了）
validateWorld();
