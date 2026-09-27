/* =====================================================================
   排行榜窗口（rank）：等级 / 装备评分 / 决斗胜场 / 通关时间（按地下城 + 难度）/ 史诗收集；全部玩家 / 好友
   数据由 net/social.js 自动上报（进城、升级、换装、转职、通关、决斗后）
   ===================================================================== */
addStyle(`
.sxrank .rtop{display:flex;gap:.5em;align-items:center;flex-wrap:wrap}
.sxrank .rlist{height:22em}
.sxrank .mine{font-size:.88em;color:#ffe8a8;background:rgba(255,210,60,.08);border:.08em solid #6a5436;border-radius:.25em;padding:.3em .6em}
`);
const SX_BOARDS = [['lvl', '等级'], ['score', '装备评分'], ['duel', '决斗胜场'], ['clear', '通关时间'], ['epic', '史诗收集']];
const SXR = { board: 'lvl', scope: 'all', dungeon: '', diff: 0 };
const sxrDungeons = () => typeof DUNGEONS === 'undefined' ? [] : Object.values(DUNGEONS).filter(d => d && d.id && d.lvl).sort((a, b) => a.lvl[0] - b.lvl[0] || (a.hidden ? 1 : 0) - (b.hidden ? 1 : 0));
function sxrValue(board, e) {
  if (board === 'lvl') return `Lv.${e.lvl}`;
  if (board === 'score') return fmtNum(e.score);
  if (board === 'duel') return `${e.win} 胜 ${e.lose} 负${e.draw ? ` ${e.draw} 平` : ''}`;
  if (board === 'clear') return sxFmtTime(e.time);
  return `${e.epics} 件`;
}
Object.assign(menus, {
  w_rank() {
    if (!sxGate('排行榜')) return null;
    if (!SXR.dungeon) { const L = sxrDungeons(); const near = L.filter(d => d.lvl[0] <= game.lvl).pop() || L[0]; SXR.dungeon = near ? near.id : ''; }
    const el = sxWin('rank', '排行榜', {
      w: 46,
      load: () => sxApi('GET', `/api/rank?board=${SXR.board}&scope=${SXR.scope}${SXR.board === 'clear' ? `&dungeon=${encodeURIComponent(SXR.dungeon)}&diff=${SXR.diff}` : ''}`),
      render: (el, d) => {
        const reload = () => { el._data = undefined; el._reload(); el._render(); };
        const tabs = h('div', { class: 'itabs' }, SX_BOARDS.map(([id, nm]) => h('div', { class: 'itab' + (SXR.board === id ? ' on' : ''), onclick: () => { SXR.board = id; sfx.click(); reload(); } }, nm)));
        const top = h('div', { class: 'rtop' }, h('div', { class: 'sxchips' }, [['all', '全部玩家'], ['friends', '好友']].map(([v, t]) => h('span', { class: 'sxchip' + (SXR.scope === v ? ' on' : ''), onclick: () => { SXR.scope = v; sfx.click(); reload(); } }, t))));
        if (SXR.board === 'clear') {
          const dg = sxInput({ style: 'width:11em' }, 'select');
          for (const D of sxrDungeons()) { const o = h('option', { value: D.id }, `${D.name}（Lv.${D.lvl[0]}）`); if (D.id === SXR.dungeon) o.selected = true; dg.append(o); }
          dg.addEventListener('change', () => { SXR.dungeon = dg.value; reload(); });
          const df = sxInput({ style: 'width:5.5em' }, 'select');
          (typeof DIFFS !== 'undefined' ? DIFFS : [{ name: '普通' }]).forEach((D, i) => { const o = h('option', { value: i }, D.name); if (i === SXR.diff) o.selected = true; df.append(o); });
          df.addEventListener('change', () => { SXR.diff = +df.value; reload(); });
          top.append(dg, df);
        }
        top.append(h('span', { class: 'sp' }), h('button', { class: 'btn sm blue', onclick: () => { sxRankReport(); setTimeout(() => el.isConnected && el._reload(), 400); } }, '刷新'));
        const vh = { lvl: '等级', score: '装备评分', duel: '战绩', clear: '用时', epic: '史诗' }[SXR.board];
        const myName = net.user && net.user.name, myCid = save.data ? String(save.data.created) : '';
        const rows = d.list.map(e => h('tr', { class: e.uid === (net.user && net.user.id) ? 'me' : '' },
          h('td', { class: 'num ' + (e.rank <= 3 ? 'rank' + e.rank : '') }, String(e.rank)),
          h('td', { style: 'font-weight:900' }, e.char || '—', e.cid === myCid && e.user === myName ? h('span', { class: 'small', style: 'color:#ffd23a;margin-left:.3em' }, '（当前角色）') : null),
          h('td', { class: 'small' }, sxClsName(e.cls, e.job)),
          h('td', { class: 'num' }, SXR.board === 'lvl' ? '' : `Lv.${e.lvl}`),
          h('td', { class: 'num', style: 'color:#ffe8a8;font-weight:900' }, sxrValue(SXR.board, e)),
          h('td', { class: 'small dim' }, e.user)));
        const table = h('div', { class: 'sxscroll rlist', 'data-sk': 'rl' }, d.list.length ? h('table', { class: 'sxtbl' },
          h('thead', {}, h('tr', {}, ['名次', '角色', '职业', SXR.board === 'lvl' ? '' : '等级', vh, '账号'].map(t => h('th', {}, t)))), h('tbody', {}, rows))
          : h('div', { class: 'sxload' }, SXR.board === 'clear' ? '还没有人通关过这个难度' : SXR.board === 'duel' ? '还没有人打过好友决斗' : '榜上还没有人'));
        const me = d.me.length ? d.me.map(e => `${e.char}：第 ${e.rank} 名（${sxrValue(SXR.board, e)}）`).join('　') : '你的角色还没有上榜';
        return [tabs, top, table, h('div', { class: 'mine' }, `我的名次（共 ${d.total} 人）：${me}`)];
      },
    });
    el.classList.add('sxrank');
    return el;
  },
});
