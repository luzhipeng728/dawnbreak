/* =====================================================================
   破晓商城窗口（商城组）：menus.open('cash', { tab, pid })，快捷键 ]（动作 cash）、菜单按钮栏“商城”
   - 页签：推荐 / 时装 / 天空 / 宠物 / 光环 / 消耗品 / 礼包 / 魔盒；右侧详情：试穿预览、说明、礼包内容、自选属性、数量、购买
   - 其他窗口：cashlog（点券获取 / 购买记录 / 点券流水 / 成就）、cashx（兑换商店）、avopt（属性选择）
   ===================================================================== */
addStyle(`
.cashwin{width:61em}
.cashwin .bd{padding:.45em .7em .55em}
.cash-top{display:flex;align-items:center;gap:.45em;flex-wrap:wrap;margin-bottom:.3em}
.cash-top .sp{flex:1}
.cash-cur{display:inline-flex;align-items:center;gap:.25em;background:#120d16;border:.08em solid #4a3c2c;border-radius:1em;padding:.08em .65em .08em .25em;font-weight:900;font-size:.86em;white-space:nowrap}
.cash-cur img,.cash-cur i{width:1.3em;height:1.3em;display:inline-block}
.cash-cur i{border-radius:50%;background:radial-gradient(circle at 35% 35%,#fff,#ff9ae8 45%,#9a2a7a)}
.cash-cur.cera{color:#ff9ae8}.cash-cur.shard{color:#c89aff}.cash-cur.gcoin{color:#ffd24a}
.cash-top .btn.sm{font-size:.8em;padding:.22em .6em}
.cash-body{display:grid;grid-template-columns:1fr 18.5em;gap:.55em;height:27.5em}
.cash-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:.4em;overflow:auto;align-content:start;padding:.35em;background:#0b090e;border:.1em solid #3a3040;border-radius:.25em}
.cash-grid::-webkit-scrollbar,.cash-side::-webkit-scrollbar{width:.4em}.cash-grid::-webkit-scrollbar-thumb,.cash-side::-webkit-scrollbar-thumb{background:#5a4a36;border-radius:.2em}
.cash-sec{grid-column:1/-1;display:flex;align-items:center;gap:.5em;color:#e8c26a;font-weight:900;font-size:.86em;border-bottom:.08em solid #3a3040;padding:.15em .1em;margin-top:.15em}
.cash-sec small{color:#9a8f7c;font-weight:600}
.cash-subs{grid-column:1/-1;display:flex;gap:.3em;flex-wrap:wrap}
.cash-subs span{padding:.12em .6em;border-radius:1em;border:.08em solid #4a3c2c;cursor:pointer;font-size:.78em;color:#b8a888;background:#18121e}
.cash-subs span.on{background:#5a4424;color:#ffe8a8;border-color:#a88450}
.ccard{position:relative;background:linear-gradient(#241b2a,#140f18);border:.1em solid #3a3040;border-radius:.3em;padding:.45em .3em .35em;text-align:center;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:.12em;min-height:8.6em}
.ccard:hover{border-color:#e8c26a;background:linear-gradient(#2e2234,#18121c)}
.ccard.on{border-color:#ffd23a;box-shadow:0 0 .6em rgba(255,210,58,.4),inset 0 0 .8em rgba(255,210,58,.12)}
.ccard .ic{width:3.7em;height:3.7em;border-radius:.3em;display:block}
.ccard .nm{font-weight:800;font-size:.76em;line-height:1.2;min-height:2.4em;display:flex;align-items:center;justify-content:center}
.ccard .pr{font-weight:900;color:#ff9ae8;font-size:.84em;white-space:nowrap}
.ccard .pr s{color:#8a806e;font-weight:600;margin-right:.25em;font-size:.85em}
.ccard .pr.free{color:#8aff9a}
.ccard .tag{position:absolute;left:-.12em;top:.35em;background:linear-gradient(90deg,#d8283a,#ff7a3a);color:#fff;font-size:.6em;font-weight:900;padding:.05em .5em .05em .4em;border-radius:0 .7em .7em 0;box-shadow:0 .1em .2em rgba(0,0,0,.5)}
.ccard .tag.g{background:linear-gradient(90deg,#2a8a3a,#5ad06a)}
.ccard .tag.p{background:linear-gradient(90deg,#8a2ad8,#d86aff)}
.ccard .lim{font-size:.6em;color:#9a8f7c}
.ccard.off{opacity:.5}
.ccard.big{grid-column:span 2;flex-direction:row;gap:.6em;text-align:left;min-height:7em;padding:.5em .7em;background:linear-gradient(120deg,#4a1420,#2a0e1a 55%,#1a0f18)}
.ccard.big .ic{width:5.2em;height:5.2em}
.ccard.big .nm{justify-content:flex-start;font-size:.95em;min-height:0}
.ccard.big .ds{font-size:.7em;color:#d8c8a8;line-height:1.35}
.ccard.wide{grid-column:1/-1;flex-direction:row;text-align:left;gap:.7em;min-height:5.4em;padding:.5em .7em;background:linear-gradient(120deg,#2a1440,#16101e 60%)}
.cpity{width:100%;height:.5em;background:#2a2230;border-radius:.3em;overflow:hidden;margin-top:.2em}
.cpity i{display:block;height:100%;background:linear-gradient(90deg,#b36bff,#ff55ff,#ffd23a)}
.cash-side{display:flex;flex-direction:column;gap:.35em;background:#0f0b13;border:.1em solid #3a3040;border-radius:.25em;padding:.5em;overflow:auto;min-height:0}
.cash-pv{position:relative;height:10.5em;flex:none;border-radius:.25em;background:radial-gradient(ellipse at 50% 70%,#3a2c48,#120d16 70%);display:grid;place-items:center;overflow:hidden}
.cash-pv canvas{max-height:100%;max-width:100%}
.cash-pv canvas.try{height:10.4em;width:8.32em;max-height:none}
.cash-pv img.bigic{width:6.5em;height:6.5em}
.cash-pv .cls{position:absolute;left:.3em;top:.25em;font-size:.65em;color:#9a8f7c}
.cash-side .t{font-weight:900;font-size:1.02em;line-height:1.25}
.cash-side .st{font-size:.74em;color:#9a8f7c}
.cash-side .ds{font-size:.76em;color:#d8ccb0;line-height:1.45}
.cash-side .pp{font-size:1.05em;font-weight:900;color:#ff9ae8}
.cash-side .pp s{color:#8a806e;font-size:.8em;margin-right:.3em}
.cash-side .row2{display:flex;gap:.3em;align-items:center;flex-wrap:wrap}
.cash-side .grow{flex:1}
.cash-side select{font-family:inherit;font-size:.78em;background:#0c0a10;color:#fff2d0;border:.08em solid #6a5436;border-radius:.2em;padding:.1em .2em;max-width:100%}
.cash-side .opts{display:grid;grid-template-columns:auto 1fr;gap:.2em .4em;align-items:center;font-size:.8em}
.cash-side .opts span{color:#b8ac90}
.cpack{display:grid;grid-template-columns:repeat(2,1fr);gap:.2em .3em;font-size:.72em}
.cpack div{display:flex;align-items:center;gap:.25em;line-height:1.1}
.cpack img{width:1.9em;height:1.9em;border-radius:.15em;flex:none}
.cash-side .btn{justify-content:center}
.cash-side .btn.buy{background:linear-gradient(180deg,#c83a7a,#7a1a4a);border-color:#ff8ac8;color:#fff}
.cash-side .btn.buy:hover{background:linear-gradient(180deg,#e84a8a,#8a2a5a)}
.cash-side .btn.off{opacity:.45;pointer-events:none}
.cash-side .err{color:#ff7a6a;font-size:.74em}
.cash-buy{position:sticky;bottom:-.5em;margin:auto -.5em -.5em;padding:.4em .5em .5em;background:linear-gradient(rgba(15,11,19,.92),#0f0b13 30%);border-top:.08em solid #3a3040;display:flex;flex-direction:column;gap:.3em}
.cash-q{display:flex;align-items:center;gap:.2em}
.cash-q b{min-width:2em;text-align:center}
.codds{font-size:.74em;width:100%;border-collapse:collapse}
.codds td{padding:.12em .3em;border-bottom:.06em solid #2a2230}
.codds td.p{text-align:right;color:#ffe070;white-space:nowrap}
.codds tr.j td{background:rgba(255,180,0,.08)}
.codds .tier{color:#e8c26a;font-weight:900}
.cash-note{font-size:.7em;color:#8a806e;line-height:1.45}
.clog{font-size:.8em;display:flex;flex-direction:column;gap:.15em;max-height:22em;overflow:auto}
.clog div{display:grid;grid-template-columns:7.5em 1fr auto;gap:.5em;padding:.15em .3em;background:#15111a;border-radius:.2em}
.clog .n{font-weight:900;color:#ff9ae8;text-align:right}.clog .n.neg{color:#9a8f7c}
.clog .tm{color:#8a806e}
.csrc{display:grid;grid-template-columns:1fr auto;gap:.25em .6em;font-size:.84em;background:#0c0a10;border:.1em solid #3a3040;border-radius:.25em;padding:.5em .7em}
.csrc b{color:#ff9ae8;text-align:right}
.csrc .h{grid-column:1/-1;color:#e8c26a;font-weight:900;border-bottom:.08em solid #3a3040;margin-top:.2em}
.cbar{height:.45em;background:#2a2230;border-radius:.3em;overflow:hidden;grid-column:1/-1}
.cbar i{display:block;height:100%;background:linear-gradient(90deg,#ff5ab0,#ffd23a)}
.cxrow{display:grid;grid-template-columns:2.6em 1fr auto 4.6em;gap:.5em;align-items:center;padding:.22em .45em;background:#15111a;border:.08em solid #2e2838;border-radius:.25em}
.cxrow .nm{font-weight:800;font-size:.88em}.cxrow .sub{font-size:.7em;color:#8a806e}
.cxrow .cost{font-weight:900;white-space:nowrap}
.cavrow{display:grid;grid-template-columns:2.6em 1fr 9em 4.2em;gap:.45em;align-items:center;padding:.2em .4em;background:#15111a;border:.08em solid #2e2838;border-radius:.25em;font-size:.86em}
.cavrow select{font-family:inherit;background:#0c0a10;color:#fff2d0;border:.08em solid #6a5436;border-radius:.2em;padding:.1em}
#menubar button[title="商城"]{grid-column:1/-1;height:calc(var(--u) * 46px);flex-direction:row;gap:.5em;border-color:#c89a3a;background:linear-gradient(#8a3a5a,#3a1224);color:#ffe8f4}
#menubar button[title="商城"]:hover{background:linear-gradient(#b04a76,#4a1a30)}
#menubar button.cash-dot{position:relative}
#menubar button.cash-dot::after{content:'领取';position:absolute;right:.35em;top:50%;transform:translateY(-50%);font-size:.62em;font-weight:900;color:#fff;background:#e8283a;border-radius:1em;padding:.05em .45em;box-shadow:0 0 .4em #ff3a3a}
`);
/* ---- 快捷键 ] = 商城（动作 cash，可在按键设置里改）；菜单按钮栏加“商城” ---- */
KEYMAP_DEFAULT.cash = ['BracketRight'];
if (!KEYMAP.cash) { KEYMAP.cash = ['BracketRight']; try { const d = JSON.parse(localStorage.getItem(UI_PREF_KEY) || 'null'); const k = d && d.keys && d.keys.cash; if (Array.isArray(k)) KEYMAP.cash = k.filter(c => typeof c === 'string').slice(0, 2); } catch (e) { /* 读不了就用默认 */ } }
ACTION_NAME.cash = '商城';
{ const G = KEY_GROUPS.find(g => g[0] === '窗口'); if (G && !G[1].includes('cash')) G[1].push('cash'); }
UI_WIN.cash = 'cash'; UI_ACTIONS.add('cash');
if (typeof MB_WIN !== 'undefined') MB_WIN.cash = 'cash';
if (typeof MENUBAR !== 'undefined' && !MENUBAR.some(b => b[0] === 'cash')) MENUBAR.push(['cash', '商城']);
// 有免费礼包可以领（新手 / 等级礼包）时，菜单按钮上显示“领取”
setInterval(() => { const b = typeof menubar !== 'undefined' && menubar.btns && menubar.btns.cash; if (!b || !save.data || !game.player) return; b.classList.toggle('cash-dot', ['pkg_newbie', 'pkg_lv10', 'pkg_lv20', 'pkg_lv30'].some(p => !cashGoodsBlock(cashGoods(p)))); }, 2000);
ITEM_WINS.push('cash', 'cashx', 'avopt', 'pet', 'synth', 'lotto', 'ticket', 'cashlog');
menus.BLOCK.add('cash'); menus.BLOCK.add('boxopen');

/* ---- 小工具 ---- */
const CW = { tab: 'rec', sub: { avatar: 'av_spring' }, sel: null, qty: 1, opts: {}, logTab: 'earn', xTab: 'shard' };
const cashImg = k => { const a = 'cash/' + k; return IMG[a] ? IMG[a].src : (typeof ASSET_SRC !== 'undefined' && ASSET_SRC[a]) || ''; };
function cashCurEl(cur) {
  const src = cashImg({ cera: 'cera', shard: 'shard_box', gcoin: 'coin_gift' }[cur]);
  return h('span', { class: 'cash-cur ' + cur, title: CUR_NAME[cur] }, src ? h('img', { src }) : h('i'), `${fmtNum(cashBal(cur))}`);
}
const cashPriceTxt = (n, cur = 'cera') => n === 0 ? '免费' : `${fmtNum(n)} ${cur === 'cera' ? '点券' : CUR_NAME[cur]}`;
const cashIconOf = (key, size = 64) => itemIconSrc(ITEMS[key] ? { ...ITEMS[key], key } : key, size);
function cashResetIn() { const now = Date.now(), d = new Date(now - 6 * 3600e3); d.setHours(24, 0, 0, 0); const ms = d.getTime() + 6 * 3600e3 - now; return `${Math.floor(ms / 3600e3)} 小时 ${Math.floor(ms / 60e3) % 60} 分`; }
const cashTm = t => { const d = new Date(t), p = n => String(n).padStart(2, '0'); return `${d.getMonth() + 1}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };
// 当季主推的节日礼包（按月份）
const cashSeasonPack = () => { const m = new Date().getMonth() + 1; return m <= 3 || m === 12 ? 'pkg_spring' : m >= 6 && m <= 8 ? 'pkg_summer' : 'pkg_academy'; };

/* ---- 动画预览（宠物 / 光环）：只在画布还挂在页面上时跑 ---- */
const cashAnims = new Set();
let cashAnimOn = false;
function cashAnimLoop() {
  cashAnimOn = cashAnims.size > 0; if (!cashAnimOn) return;
  const t = performance.now() / 1000;
  for (const A of cashAnims) { if (!A.cv.isConnected) { if (A.born + 500 < performance.now()) cashAnims.delete(A); continue; } A.draw(t); }
  requestAnimationFrame(cashAnimLoop);
}
function cashAnimCanvas(w, h, draw) {
  const cv = h_canvas(w, h), x = cv.getContext('2d');
  cashAnims.add({ cv, born: performance.now(), draw: t => { x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, w, h); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'medium'; draw(x, t); } });
  if (!cashAnimOn) requestAnimationFrame(cashAnimLoop);
  return cv;
}
function h_canvas(w, hh) { const cv = document.createElement('canvas'); cv.width = w; cv.height = hh; return cv; }
// 宠物（走两步停一下）+ 可选光环
function cashPetPreview(id, aura, w = 220, hh = 150) {
  if (id && !IMG[`pet/${id}_0`]) loadBundles(['cash']);
  return cashAnimCanvas(w, hh, (x, t) => {
    if (aura) cashDrawAuraAt(x, aura, w / 2, hh - 22, t, 58);
    if (id) { const ph = t % 4, mv = ph < 2, X = w / 2 + (mv ? Math.sin(ph / 2 * Math.PI) * 40 : 0), face = mv && ph < 1 ? 1 : mv ? -1 : 1, P = PETS[id] || {};
      cashDrawPetAt(x, id, X, hh - 22, P.fly ? 30 + Math.sin(t * 3) * 6 : mv ? Math.abs(Math.sin(t * 11)) * 8 : 0, face, mv, t, 1.5); }
  });
}
// 试穿：当前职业 + 当前装备，换上这些时装
function cashTryOn(items) {
  const p = game.player; if (!p || typeof avatarCanvas !== 'function' || !SPR_DATA[p.cls]) return null;
  const eq = { ...inv.equip }; for (const it of items) eq[it.slot] = it;
  const cv = avatarCanvas(p.cls, lookFromEquip(p.cls, eq), 200, 250, 1.6); cv.classList.add('try');
  return cv;
}

/* ---- 商城主窗口 ---- */
Object.assign(menus, {
  w_cash(arg = {}) {
    inv.ensure(); cashData();
    if (arg.tab) CW.tab = arg.tab; if (arg.pid) { CW.sel = arg.pid; CW.qty = 1; }
    loadBundles(['cash']).then(() => { const el = menus.wins.cash; if (el && el._render) { iconUrlCache.clear(); el._render(); } });
    const el = itemWin('cash', '破晓商城', el => {
      const top = h('div', { class: 'cash-top' },
        cashCurEl('cera'), cashCurEl('shard'), cashCurEl('gcoin'), h('span', { class: 'sp' }),
        h('button', { class: 'btn sm', onclick: () => { sfx.click(); menus.show('cashlog', { tab: 'earn' }); } }, '点券获取'),
        h('button', { class: 'btn sm', onclick: () => { sfx.click(); menus.show('cashx'); } }, '兑换商店'),
        h('button', { class: 'btn sm', onclick: () => { sfx.click(); menus.show('lotto'); } }, `破晓启示${inv.count('tk_lotto') ? `（${inv.count('tk_lotto')}）` : ''}`),
        h('button', { class: 'btn sm', onclick: () => { sfx.click(); menus.show('synth'); } }, '装扮合成'),
        h('button', { class: 'btn sm', onclick: () => { sfx.click(); menus.show('avopt'); } }, '属性选择'),
        h('button', { class: 'btn sm', onclick: () => { sfx.click(); menus.show('pet'); } }, '宠物'),
        h('button', { class: 'btn sm blue', onclick: () => { sfx.click(); menus.show('cashlog', { tab: 'buys' }); } }, '购买记录'));
      const tabs = h('div', { class: 'itabs' }, CASH_TABS.map(([id, nm]) => h('div', { class: 'itab' + (CW.tab === id ? ' on' : ''), onclick: () => { CW.tab = id; CW.sel = null; closeItemDialog(); sfx.click(); el._render(); } }, nm)));
      const grid = h('div', { class: 'cash-grid', 'data-sk': 'cg-' + CW.tab });
      cashFillGrid(grid, el);
      if (!CW.sel || (!cashGoods(CW.sel) && !(CW.tab === 'sky' && CW.sel.startsWith('sky:')))) { const first = grid.querySelector('.ccard[data-pid]'); if (first) CW.sel = first.dataset.pid; }
      for (const c of grid.querySelectorAll('.ccard[data-pid]')) if (c.dataset.pid === CW.sel) c.classList.add('on');
      const side = h('div', { class: 'cash-side', 'data-sk': 'cs' }, ...cashDetail(cashGoods(CW.sel), el));
      return [top, tabs, h('div', { class: 'cash-body' }, grid, side), h('div', { class: 'ihint' }, `点券全部靠游戏获得：升级、首次通关、通关评价（S 以上更多）、每日任务、成就、金币兑换。每日特惠 ${cashResetIn()} 后刷新。`)];
    }, { w: 61, at: 'center' });
    el.classList.add('cashwin'); el.dataset.block = '1';
    return el;
  },
});
function cashCard(G, el, o = {}) {
  const D = ITEMS[G.key] || {}, block = cashGoodsBlock(G), left = cashLimitLeft(G.pid, G.limit);
  const tagCls = G.tag === '免费' ? ' g' : G.tag === '限时' || G.tag === '十连' ? ' p' : '';
  const c = h('div', { class: 'ccard' + (o.big ? ' big' : '') + (block && !(G.lvl && game.lvl < G.lvl) ? ' off' : ''), 'data-pid': G.pid },
    G.tag ? h('span', { class: 'tag' + tagCls }, G.tag) : null,
    h('img', { class: 'ic', src: cashIconOf(G.key, 96) }),
    h('div', { style: o.big ? 'display:flex;flex-direction:column;gap:.2em' : 'display:contents' },
      h('div', { class: `nm q${G.whole ? 1 : D.rar || 0}` }, cashGoodsName(G)),
      o.big && o.desc ? h('div', { class: 'ds' }, o.desc) : null,
      h('div', { class: 'pr' + (G.price === 0 ? ' free' : '') }, G.base ? h('s', {}, fmtNum(G.base)) : null, cashPriceTxt(G.price, G.cur)),
      G.limit ? h('div', { class: 'lim' }, block && !(G.lvl && game.lvl < G.lvl) ? block : `${LIMIT_TXT[G.limit.per]}限购 ${Math.max(0, left)}/${G.limit.n}`) : G.lvl && game.lvl < G.lvl ? h('div', { class: 'lim' }, `Lv.${G.lvl} 可领取`) : null));
  c.addEventListener('click', () => { CW.sel = G.pid; CW.qty = 1; CW.opts = {}; closeItemDialog(); sfx.click(); el._render(); });
  c.addEventListener('dblclick', () => cashBuyAsk(G, el));
  return c;
}
function cashFillGrid(grid, el) {
  const sec = (t, sub) => grid.append(h('div', { class: 'cash-sec' }, t, sub ? h('small', {}, sub) : null));
  const add = (pid, o) => { const G = typeof pid === 'string' ? cashGoods(pid) : pid; if (G && ITEMS[G.key]) grid.append(cashCard(G, el, o)); };
  const tab = CW.tab;
  if (tab === 'rec') {
    const sp = cashSeasonPack();
    sec('当季主推', '节日礼包 · 多买多送');
    add(sp, { big: true, desc: `整套节日时装 + 宠物 + 光环 + 称号 + 宝珠 + 抽奖券，比单买便宜约 4 成。累计 2 / 3 / 5 套送至尊光环 / 称号 / 宠物（已买 ${cashData().multi} 套）。` });
    add('box_magic', { big: true, desc: `开出天空套部件兑换券、史诗装备、限定光环与称号……连续 100 次必出大奖（当前 ${cashData().pity.box_magic || 0}/100）。` });
    const D = cashDeals();
    sec('每日特惠', `${cashResetIn()} 后刷新`); for (const g of D.day) add(g);
    if (D.week) { sec('每周特惠'); add(D.week); }
    sec('本周限时礼包'); add(cashLtdPack());
    const free = ['pkg_newbie', 'pkg_lv10', 'pkg_lv20', 'pkg_lv30'].filter(p => !cashGoodsBlock(cashGoods(p)));
    if (free.length) { sec('可以领取的免费礼包'); for (const p of free) add(p); }
    return;
  }
  const list = Object.values(CASH_GOODS).filter(G => G.tab === tab && ITEMS[G.key] && (!G.ltd || cashLtdPack() === G.pid));
  if (tab === 'avatar') {
    const subs = [...CASH_ADV_SETS.map(s => [s, CASH_SETS[s].name]), ['weapon', '武器装扮'], ['etc', '其他']];
    const cur = CW.sub.avatar || subs[0][0];
    grid.append(h('div', { class: 'cash-subs' }, subs.map(([id, nm]) => h('span', { class: id === cur ? 'on' : '', onclick: () => { CW.sub.avatar = id; CW.sel = null; sfx.click(); el._render(); } }, nm))));
    for (const G of list.filter(G => G.sub === cur)) add(G);
    return;
  }
  if (tab === 'sky') {
    sec('稀有装扮（天空套）', '不直接出售：用装扮合成器合成，或用天空套部件兑换券兑换');
    for (const set of CASH_SKY_SETS) {
      const c = h('div', { class: 'ccard wide' + (CW.sel === 'sky:' + set ? ' on' : ''), 'data-sky': set },
        h('img', { class: 'ic', src: cashIconOf(avKey(set, 'av_top'), 96) }),
        h('div', {}, h('div', { class: 'nm q2', style: 'justify-content:flex-start;min-height:0;font-size:.95em' }, `${CASH_SETS[set].name}（稀有装扮 8 件）`), h('div', { class: 'ds', style: 'font-size:.72em;color:#d8c8a8' }, CASH_SETS[set].desc),
          h('div', { class: 'lim', style: 'font-size:.7em' }, `已拥有 ${AV_PIECE_SLOTS.filter(s => inv.count(avKey(set, s)) || (inv.equip[s] && inv.equip[s].key === avKey(set, s))).length}/8 件 · 点击试穿`)));
      c.addEventListener('click', () => { CW.sel = 'sky:' + set; sfx.click(); el._render(); });
      grid.append(c);
    }
    sec('合成器与材料');
  }
  if (tab === 'pack') {
    const fest = list.filter(G => G.fest), other = list.filter(G => !G.fest);
    sec('节日礼包', `多买多送：已累计 ${cashData().multi} 套`); for (const G of fest) add(G);
    sec('其他礼包'); for (const G of other) add(G);
    return;
  }
  for (const G of list) add(G);
  if (tab === 'box') grid.append(h('div', { class: 'cash-sec' }, h('small', {}, '每个箱子都公开概率：选中后点“概率公示”。魔盒每开 1 个得 1 个魔盒碎片，碎片可以在兑换商店换好东西。')));
}
/* ---- 右侧详情 ---- */
function cashDetail(G, el) {
  if (CW.sel && CW.sel.startsWith('sky:')) return cashSkyDetail(CW.sel.slice(4), el);
  if (!G) return [h('div', { class: 'ds' }, '选择左边的商品查看详情。')];
  const D = ITEMS[G.key], block = cashGoodsBlock(G), out = [];
  const preview = cashPreviewEl(G);
  out.push(h('div', { class: 'cash-pv' }, preview, game.player && preview && preview.tagName === 'CANVAS' && (D.slot || '').startsWith('av_') && !D.pet && !D.aura ? h('span', { class: 'cls' }, '试穿') : null));
  out.push(h('div', { class: `t q${G.whole ? 1 : D.rar}` }, cashGoodsName(G)));
  out.push(h('div', { class: 'st' }, G.whole ? `高级装扮 · 整套 8 件（单买合计 ${fmtNum(AV_PIECE_SLOTS.reduce((s, k) => s + CASH_SLOT_PRICE[k], 0))}）` : `${RARITY[D.rar].name} · ${itemTypeName({ ...D, key: G.key })}`));
  out.push(h('div', { class: 'ds' }, D.desc || ''));
  // 装备类：官方 tooltip（属性 / 套装）
  if (D.kind === 'equip' && !G.whole) { const it = makeItem(G.key); if (CW.opts[G.key]) { it.opt = CW.opts[G.key]; normalizeItem(it); } const tip = itemTip(it, { cmp: false }); tip.style.width = '100%'; tip.style.fontSize = '.78em'; out.push(tip); }
  // 礼包内容
  if (CASH_PACKS[G.key]) out.push(h('div', { class: 'st' }, '礼包内容'), cashRewardList(CASH_PACKS[G.key]));
  if (G.fest) out.push(h('div', { class: 'cash-note' }, `多买多送（三种节日礼包合计，已累计 ${cashData().multi} 套）：`, ...CASH_MULTI.map(T => h('div', { style: cashData().multiGot[T.n] ? 'color:#6aff7a' : '' }, `${cashData().multiGot[T.n] ? '✔' : '·'} 累计 ${T.n} 套：${T.name}`))));
  // 箱子：概率公示 / 保底
  if (CASH_BOXES[G.key]) {
    if (G.key === 'box_magic') { const n = cashData().pity.box_magic || 0; out.push(h('div', { class: 'cash-note' }, `保底进度 ${n}/100（出大奖后归零）· 魔盒碎片 ${cashBal('shard')}`), h('div', { class: 'cpity' }, h('i', { style: `width:${n}%` }))); }
  }
  // 时装自选属性
  const avs = G.whole ? AV_PIECE_SLOTS.map(s => avKey(G.whole, s)) : D.avOpt ? [G.key] : [];
  if (avs.length) {
    const box = h('div', { class: 'opts' });
    for (const k of avs) {
      const Dk = ITEMS[k], T = cashAvOpts(Dk), sel = h('select', {}, T.map(([s, v]) => h('option', { value: s }, statLine(s, v))));
      sel.value = CW.opts[k] || T[0][0];
      sel.addEventListener('change', () => { CW.opts[k] = sel.value; if (!G.whole) el._render(); });
      box.append(h('span', {}, G.whole ? SLOT_NAME[Dk.slot] : '自选属性'), sel);
    }
    out.push(h('div', { class: 'st' }, '购买时选择属性（之后在“属性选择”里第一次更换免费）'), box);
  }
  // 价格 / 数量 / 按钮
  const stack = D.kind !== 'equip' && !G.whole && !G.fest && !CASH_PACKS[G.key];
  const left = cashLimitLeft(G.pid, G.limit), maxQ = Math.max(1, Math.min(stack ? 99 : 1, left, G.price ? Math.floor(cashBal(G.cur) / G.price) || 1 : 1));
  CW.qty = clamp(CW.qty, 1, maxQ);
  const buy = h('div', { class: 'cash-buy' });
  buy.append(h('div', { class: 'pp' }, G.base ? h('s', {}, fmtNum(G.base)) : null, cashPriceTxt(G.price * CW.qty, G.cur), G.limit ? h('span', { class: 'st', style: 'margin-left:.5em' }, `${LIMIT_TXT[G.limit.per]}限购 ${Math.max(0, left)}/${G.limit.n}`) : null));
  if (stack && maxQ > 1) buy.append(h('div', { class: 'cash-q' }, h('span', { class: 'st' }, '数量'), ...[-10, -1].map(d => h('button', { class: 'btn sm', onclick: () => { CW.qty = clamp(CW.qty + d, 1, maxQ); el._render(); } }, String(d))), h('b', {}, String(CW.qty)), ...[1, 10].map(d => h('button', { class: 'btn sm', onclick: () => { CW.qty = clamp(CW.qty + d, 1, maxQ); el._render(); } }, '+' + d))));
  if (block) buy.append(h('div', { class: 'err' }, block));
  const btns = h('div', { class: 'row2' });
  const off = block || cashBal(G.cur) < G.price * CW.qty ? ' off' : '';
  btns.append(h('button', { class: 'btn buy grow' + off, onclick: () => { sfx.click(); cashBuyAsk(G, el); } }, G.price === 0 ? '领取' : '购买'));
  if (CASH_BOXES[G.key] || CASH_PACKS[G.key] || (ITEMS[G.key].cashUse === 'box')) btns.append(h('button', { class: 'btn grow' + off, onclick: () => { sfx.click(); cashBuyAsk(G, el, true); } }, G.price === 0 ? '领取并打开' : '买下并打开'));
  if (CASH_BOXES[G.key]) btns.append(h('button', { class: 'btn sm blue', onclick: () => { sfx.click(); cashOddsDialog(G.key, el); } }, '概率公示'));
  buy.append(btns);
  if (cashBal(G.cur) < G.price && !block) buy.append(h('div', { class: 'err' }, `${CUR_NAME[G.cur]}不足。点上方“点券获取”看看怎么赚点券。`));
  out.push(buy);
  return out;
}
function cashSkyDetail(set, el) {
  const items = AV_PIECE_SLOTS.map(s => makeItem(avKey(set, s)));
  const pv = cashTryOn(items);
  const tip = itemTip(items[4], { cmp: false }); tip.style.width = '100%'; tip.style.fontSize = '.78em';
  return [h('div', { class: 'cash-pv' }, pv || h('img', { class: 'bigic', src: cashIconOf(avKey(set, 'av_top'), 128) }), pv ? h('span', { class: 'cls' }, '试穿（8 件）') : null),
    h('div', { class: 't q2' }, `${CASH_SETS[set].name}（稀有装扮）`), h('div', { class: 'ds' }, CASH_SETS[set].desc), tip,
    h('div', { class: 'cash-note' }, '获得方式：装扮合成器（2 件同部位高级装扮，20%）、黄金装扮合成器（30%）、梦想装扮合成器（任意 8 件，100% 指定部位）；天空套部件兑换券（魔盒大奖、破晓启示、兑换商店）。'),
    h('button', { class: 'btn buy', onclick: () => { sfx.click(); menus.show('synth', { set }); } }, '去合成')];
}
function cashPreviewEl(G) {
  const D = ITEMS[G.key];
  if (G.whole) return cashTryOn(AV_PIECE_SLOTS.map(s => makeItem(avKey(G.whole, s)))) || h('img', { class: 'bigic', src: cashIconOf(G.key, 128) });
  if (D.pet) return cashPetPreview(D.pet, null);
  if (D.aura) return cashPetPreview(null, D.aura);
  if (D.kind === 'equip' && (D.slot || '').startsWith('av_') && !D.slot.startsWith('av_pet')) { const cv = cashTryOn([makeItem(G.key)]); if (cv) return cv; }
  return h('img', { class: 'bigic', src: cashIconOf(G.key, 128) });
}
function cashRewardList(list) {
  return h('div', { class: 'cpack' }, list.filter(cashRewardOk).map(r => { const k = r.set ? avKey(r.set, 'av_top') : r.key; return h('div', {}, k ? h('img', { src: cashIconOf(k, 48) }) : null, h('span', { class: 'q' + cashRewardRar(r) }, cashRewardName(r))); }));
}
function cashOddsDialog(key, win) {
  const odds = cashBoxOdds(key), B = CASH_BOXES[key];
  let lastTier = null; const rows = [];
  for (const o of odds) {
    if (o.tier !== lastTier && B.tiers.length > 1) { lastTier = o.tier; const tp = odds.filter(x => x.tier === o.tier).reduce((s, x) => s + x.p, 0); rows.push(h('tr', {}, h('td', { class: 'tier' }, `【${o.tier}】`), h('td', { class: 'p tier' }, `${(tp * 100).toFixed(2)}%`))); }
    rows.push(h('tr', { class: o.jackpot ? 'j' : '' }, h('td', { class: 'q' + o.rar }, o.name), h('td', { class: 'p' }, `${(o.p * 100).toFixed(o.p < 0.01 ? 2 : 1)}%`)));
  }
  const body = h('div', { style: 'max-height:20em;overflow:auto' }, h('table', { class: 'codds' }, rows),
    h('div', { class: 'cash-note', style: 'margin-top:.4em' }, B.pity ? `保底：连续 ${B.pity - 1} 次没有开出“大奖”时，第 ${B.pity} 次必定从大奖档里开出（按上表权重）。当前进度 ${cashData().pity[key] || 0}/${B.pity}。` : B.pityOf ? `计入${ITEMS[B.pityOf].name}的保底。` : '', B.rolls ? `每个礼盒开 ${B.rolls} 次。` : '', ' 概率四舍五入显示，游戏内合计为 100%。'));
  itemDialog(win, { title: `${ITEMS[key].name} · 概率公示`, body, okText: '知道了', onOk: () => true });
}
// 购买确认（贵的二次确认）；open = 买完直接打开
function cashBuyAsk(G, win, open) {
  const n = CW.qty || 1, cost = G.price * n;
  const done = () => {
    const r = cashBuy(G.pid, n, { opts: CW.opts });
    if (r.err) { toastMsg(r.err, '#ff6a6a'); sfx.error(); return; }
    toastMsg(`购买成功：${cashGoodsName(G)}${n > 1 ? ' ×' + n : ''}${cost ? `（-${fmtNum(cost)} ${CUR_NAME[G.cur]}）` : ''}`, '#ff9ae8');
    CW.qty = 1; itemsRefresh();
    if (open) {
      const D = ITEMS[G.key];
      if (D.cashUse === 'box') cashBoxUI(G.key, Math.min(10, (G.n || 1) * n));
      else if (D.cashUse === 'pack') { const it = inv.items.find(x => x.key === G.key); if (it) inv.useItem(it); itemsRefresh(); }
    } else if (r.items && r.items.length && (G.fest || G.whole || CASH_PACKS[G.key] === undefined && r.items.some(it => it.rar >= 3))) cashShowGot('购买成功', r.items);
  };
  if (cost < 3000 || !win) return done();
  itemDialog(win, { title: '确认购买', msg: `${itemNameHtml({ ...ITEMS[G.key], name: cashGoodsName(G), n })}<hr>花费 <b style="color:#ff9ae8">${fmtNum(cost)} ${CUR_NAME[G.cur]}</b>（持有 ${fmtNum(cashBal(G.cur))}）`, okText: '购买', onOk: done });
}

/* ---- 点券获取 / 购买记录 / 点券流水 / 成就 ---- */
Object.assign(menus, {
  w_cashlog(arg = {}) {
    if (arg.tab) CW.logTab = arg.tab;
    const el = itemWin('cashlog', '点券与记录', el => {
      const S = cashData(), tabs = h('div', { class: 'itabs' }, [['earn', '点券获取'], ['buys', '购买记录'], ['open', '开箱记录'], ['log', '点券流水'], ['ach', '成就']].map(([id, nm]) => h('div', { class: 'itab' + (CW.logTab === id ? ' on' : ''), onclick: () => { CW.logTab = id; sfx.click(); el._render(); } }, nm)));
      const out = [h('div', { class: 'cash-top' }, cashCurEl('cera'), cashCurEl('shard'), cashCurEl('gcoin')), tabs];
      if (CW.logTab === 'earn') {
        const E = CASH_EARN, T = S.today, left = E.exch.cap - T.exch;
        const pct = (a, b) => h('div', { class: 'cbar' }, h('i', { style: `width:${Math.min(100, a / b * 100)}%` }));
        const nb = [100, 200, 500].filter(v => v <= left);
        out.push(h('div', { class: 'csrc' },
          h('div', { class: 'h' }, '每天'), h('span', {}, `通关评价（SSS ${E.rank.SSS} / SS ${E.rank.SS} / S ${E.rank.S} / A ${E.rank.A} / B ${E.rank.B}，难度越高越多）`), h('b', {}, `${T.rank}/${E.rankCap}`), pct(T.rank, E.rankCap),
          h('span', {}, `完成每日任务（每个 ${E.daily}）`), h('b', {}, `今天 ${T.daily} 个`),
          h('span', {}, `金币兑换（${E.exch.rate} 金币 = 1 点券）`), h('b', {}, `${T.exch}/${E.exch.cap}`), pct(T.exch, E.exch.cap),
          h('div', { class: 'row', style: 'grid-column:1/-1;gap:.3em;flex-wrap:wrap' }, h('span', { class: 'igold' }, `${fmtNum(game.gold)} G`), ...(nb.length ? nb : left > 0 ? [left] : []).map(v => h('button', { class: 'btn sm', onclick: () => { const r = cashExchGold(v); if (r.err) { toastMsg(r.err, '#ff6a6a'); sfx.error(); } el._render(); } }, `兑换 ${v} 点券（${fmtNum(v * E.exch.rate)} G）`)), left <= 0 ? h('span', { class: 'dim small' }, '今天的兑换额度用完了') : null),
          h('div', { class: 'h' }, '一次性'), h('span', {}, `升级（新等级 × ${E.lvl}）`), h('b', {}, `下一级 +${(game.lvl + 1) * E.lvl}`),
          h('span', {}, `首次通关地下城 ${E.first}；首次通关冒险 / 勇士 / 王者再 +${E.firstDiff.slice(1).join(' / +')}`), h('b', {}, `已首通 ${Object.keys(S.first).filter(k => !k.includes(':')).length} 个`),
          h('span', {}, '成就'), h('b', {}, `${Object.keys(S.ach).length}/${CASH_ACH.length}`),
          h('div', { class: 'h' }, '登录后'), h('span', {}, '每日签到（社交与经济服务）'), h('b', {}, '—')),
          h('div', { class: 'cash-note' }, '破晓地下城不涉及真钱，所有点券都靠游戏获得。认真玩一周大约能买一套节日时装。'));
      } else if (CW.logTab === 'buys') {
        out.push(h('div', { class: 'clog', 'data-sk': 'lb' }, S.buys.length ? S.buys.map(b => h('div', {}, h('span', { class: 'tm' }, cashTm(b.t)), h('span', {}, `${b.name}${b.n > 1 ? ' ×' + b.n : ''}`), h('span', { class: 'n neg' }, `-${fmtNum(b.cost)} ${CUR_NAME[b.cur] || ''}`))) : h('div', { class: 'dim' }, '还没有购买记录')));
      } else if (CW.logTab === 'open') {
        const L = S.openLog || [], by = S.openedBy || {};
        out.push(h('div', { class: 'cash-note' }, `累计开箱 ${fmtNum(S.opened || 0)} 个：${Object.keys(by).filter(k => ITEMS[k]).map(k => `${ITEMS[k].name} ${by[k]}`).join('、') || '还没有开过箱子'}。魔盒保底进度 ${S.pity.box_magic || 0}/100。下面只记大奖和神器以上的物品。`),
          h('div', { class: 'clog', 'data-sk': 'lo' }, L.length ? L.map(b => h('div', { style: b.jp ? 'background:#2a1a10' : '' }, h('span', { class: 'tm' }, cashTm(b.t)), h('span', {}, `${b.box} → `, h('b', { class: 'q' + Math.min(5, b.rar) }, b.name), b.forced ? h('span', { style: 'color:#ffd23a' }, '（保底）') : null), h('span', { class: 'n', style: 'color:#ffd23a' }, b.jp ? '大奖' : ''))) : h('div', { class: 'dim' }, '还没有开出过好东西，去试试魔盒吧！')));
      } else if (CW.logTab === 'log') {
        out.push(h('div', { class: 'clog', 'data-sk': 'll' }, S.log.length ? S.log.map(b => h('div', {}, h('span', { class: 'tm' }, cashTm(b.t)), h('span', {}, b.why), h('span', { class: 'n' + (b.n < 0 ? ' neg' : '') }, `${b.n > 0 ? '+' : ''}${fmtNum(b.n)}`))) : h('div', { class: 'dim' }, '还没有点券流水')));
      } else {
        out.push(h('div', { class: 'clog', 'data-sk': 'la' }, CASH_ACH.map(A => { const done = S.ach[A.id], v = S.stat[A.stat] || 0; return h('div', { style: done ? 'background:#1a2418' : '' }, h('span', { class: done ? '' : 'tm', style: done ? 'color:#6aff7a' : '' }, done ? '✔ 已达成' : `${fmtNum(Math.min(v, A.n))}/${fmtNum(A.n)}`), h('span', {}, h('b', {}, A.name), `　${A.desc}`), h('span', { class: 'n' }, `+${A.cera}`)); })));
      }
      return out;
    }, { w: 34, at: 'center' });
    return el;
  },
  /* ---- 兑换商店 ---- */
  w_cashx(arg = {}) {
    if (arg.tab) CW.xTab = arg.tab;
    const el = itemWin('cashx', '兑换商店', el => {
      const E = CASH_EXCH[CW.xTab], tabs = h('div', { class: 'itabs' }, Object.keys(CASH_EXCH).map(id => h('div', { class: 'itab' + (CW.xTab === id ? ' on' : ''), onclick: () => { CW.xTab = id; sfx.click(); el._render(); } }, CASH_EXCH[id].name)));
      const list = h('div', { class: 'ilist', 'data-sk': 'cx' });
      E.goods.forEach((G, i) => {
        if (!ITEMS[G.key]) return;
        const id = `x:${CW.xTab}:${G.key}:${G.n}`, left = cashLimitLeft(id, G.limit), can = left > 0 && cashBal(CW.xTab) >= G.cost;
        list.append(h('div', { class: 'cxrow' }, itemSlot({ ...ITEMS[G.key], key: G.key, n: G.n }, {}),
          h('div', {}, h('div', { class: `nm q${ITEMS[G.key].rar}` }, `${ITEMS[G.key].name}${G.n > 1 ? ' ×' + G.n : ''}`), h('div', { class: 'sub' }, G.limit ? `${LIMIT_TXT[G.limit.per]}限兑 ${Math.max(0, left)}/${G.limit.n}` : '不限兑换次数')),
          h('span', { class: 'cost', style: `color:${CW.xTab === 'shard' ? '#c89aff' : '#ffd24a'}` }, `${G.cost} ${E.name}`),
          h('button', { class: 'btn sm' + (can ? '' : ' off'), onclick: () => { const r = cashExchange(CW.xTab, i, 1); if (r.err) { toastMsg(r.err, '#ff6a6a'); sfx.error(); } else { toastMsg(`兑换成功：${ITEMS[G.key].name}${G.n > 1 ? ' ×' + G.n : ''}`, '#ffd23a'); if (r.items.some(it => it.rar >= 3)) cashShowGot('兑换成功', r.items); } itemsRefresh(); } }, '兑换')));
      });
      return [h('div', { class: 'cash-top' }, cashCurEl('shard'), cashCurEl('gcoin'), h('span', { class: 'sp' }), h('span', { class: 'cash-note' }, CW.xTab === 'shard' ? '每打开 1 个魔盒得 1 个碎片（黄金魔盒 3 个）' : '节日礼包附赠礼包币，破晓启示也能抽到')), tabs, list];
    }, { w: 30, at: 'right' });
    return el;
  },
  /* ---- 时装属性选择 ---- */
  w_avopt() {
    const el = itemWin('avopt', '装扮属性选择', el => {
      const list = cashAvItems(), box = h('div', { class: 'ilist', 'data-sk': 'ao' });
      for (const it of list) {
        const D = ITEMS[it.key], T = cashAvOpts(D), worn = inv.equip[it.slot] === it, sel = h('select', {}, T.map(([s, v]) => h('option', { value: s }, statLine(s, v))));
        sel.value = it.opt || T[0][0];
        box.append(h('div', { class: 'cavrow' }, itemSlot(it, { cmp: false }),
          h('div', {}, h('div', { class: `q${it.rar}`, style: 'font-weight:800' }, it.name), h('div', { class: 'small dim' }, `${SLOT_NAME[it.slot]}${worn ? ' · 穿戴中' : ''} · ${it.optLock ? '更换需要变更券' : '第一次选择免费'}`)), sel,
          h('button', { class: 'btn sm', onclick: () => { const r = cashSetOpt(it, sel.value); if (r.err) { toastMsg(r.err, '#ff6a6a'); sfx.error(); } else { toastMsg(`属性已更换为 ${statLine(sel.value, T.find(o => o[0] === sel.value)[1])}${r.free ? '（免费）' : ''}`, '#8aff9a'); sfx.enhanceOk(); } itemsRefresh(); } }, '更换')));
      }
      if (!list.length) box.append(h('div', { class: 'dim', style: 'padding:1em;text-align:center' }, '没有可以选择属性的时装（商城的高级装扮 / 稀有装扮可以自选属性）'));
      return [h('div', { class: 'cash-note' }, `官方装扮属性选择：每件时装第一次选择免费，之后每次更换消耗 1 张装扮属性变更券（持有 ${inv.count('tk_avopt')} 张，商城 100 点券）。`), box];
    }, { w: 30, at: 'right' });
    return el;
  },
});
