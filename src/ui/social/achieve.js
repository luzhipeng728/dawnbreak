/* =====================================================================
   成就窗口（achieve，快捷键 U，菜单按钮“成就”）：总览（成就点、各档数量、各分类进度、最近达成、一键领奖）+ 六个分类页签（进度条、奖励、领取）
   达成时屏幕下方（技能栏上面）弹出成就提示（DOM + CSS 动画，排队播放，最多同时 2 条）并播放音效；单机也能用（社交类成就需要登录才能推进）
   ===================================================================== */
addStyle(`
.achw .abody{display:flex;gap:.6em;min-height:0;height:27em}
.achw .acats{width:9.5em;flex:none;display:flex;flex-direction:column;gap:.2em}
.achw .acat{padding:.4em .55em;border-radius:.3em;cursor:pointer;background:#16111b;border:.08em solid #2e2838;font-weight:800;font-size:.9em;display:flex;align-items:center;gap:.3em}
.achw .acat:hover{border-color:#8a6a3a}.achw .acat.on{border-color:#ffd23a;background:linear-gradient(#4a3618,#221608);color:#ffe8a8}
.achw .acat .n{margin-left:auto;font-size:.8em;color:#9a8f7c}
.achw .acat .dot{width:.5em;height:.5em;border-radius:50%;background:#ff4a3a;box-shadow:0 0 .3em #ff4a3a}
.achw .amain{flex:1;min-width:0;display:flex;flex-direction:column;gap:.4em}
.achw .alist{flex:1;overflow:auto;display:flex;flex-direction:column;gap:.3em;padding-right:.2em}
.achw .arow{display:flex;gap:.6em;align-items:center;padding:.45em .55em;border-radius:.3em;background:#16111b;border:.08em solid #2a2230}
.achw .arow.done{background:linear-gradient(90deg,rgba(90,70,20,.35),#16111b 60%)}
.achw .arow.claim{border-color:#ffd23a;box-shadow:0 0 .5em rgba(255,210,60,.3)}
.achw .arow .t{flex:1;min-width:0}
.achw .arow .nm{font-weight:900;color:#f0e6d0}.achw .arow.done .nm{color:#ffe8a8}
.achw .arow .ds{font-size:.8em;color:#9a8f7c;margin:.1em 0 .2em}
.achw .arow .rw{font-size:.76em;color:#8fe8ff}
.achw .arow .tag{font-size:.7em;font-weight:900;color:#9aff7a;border:.06em solid #4aa05a;border-radius:.2em;padding:0 .3em;margin-left:.4em}
.achw .abar{height:.5em;background:#0b090e;border-radius:.3em;overflow:hidden;border:.06em solid #2e2838}
.achw .abar i{display:block;height:100%;background:linear-gradient(90deg,#8a6a2a,#ffd23a)}
.achw .arow .pv{font-size:.75em;color:#c8b890;text-align:right;min-width:5em}
.achw .arow .side{display:flex;flex-direction:column;align-items:flex-end;gap:.2em;min-width:5.5em}
.achw .arow .pt{font-weight:900;font-size:.85em}
.ach-medal{width:2.4em;height:2.4em;flex:none;border-radius:50%;display:grid;place-items:center;font-weight:900;font-size:.95em;color:#2a1a08;box-shadow:inset 0 -.2em .3em rgba(0,0,0,.35),inset 0 .15em .2em rgba(255,255,255,.55),0 0 0 .12em rgba(0,0,0,.6)}
.ach-medal.off{filter:grayscale(1) brightness(.5)}
.achw .ov{display:flex;flex-direction:column;gap:.5em;overflow:auto}
.achw .ovtop{display:flex;gap:1em;align-items:center;padding:.5em .8em;border-radius:.4em;background:linear-gradient(90deg,rgba(90,70,20,.45),rgba(20,14,24,.6));border:.08em solid #6a5436}
.achw .ovtop .big{font-size:2.2em;font-weight:900;color:#ffd23a;text-shadow:0 0 .3em rgba(255,200,60,.4)}
.achw .ovcats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.4em}
.achw .ovcat{padding:.4em .5em;border-radius:.3em;background:#16111b;border:.06em solid #2e2838;cursor:pointer;font-size:.85em}
.achw .ovcat:hover{border-color:#8a6a3a}
.achw .ovcat b{display:block;margin-bottom:.2em}
.achw .recent .r{display:flex;gap:.5em;align-items:center;font-size:.85em;padding:.2em 0}
.achw .recent .ach-medal{width:1.6em;height:1.6em;font-size:.7em}
#dom:has(#result) #achpop{bottom:auto;top:calc(var(--u) * 24px)}
#achpop{position:absolute;left:50%;bottom:calc(var(--u) * 175px);transform:translateX(-50%);z-index:30;pointer-events:none!important;display:flex;flex-direction:column-reverse;gap:.4em;align-items:center}
#achpop .p{display:flex;gap:.7em;align-items:center;padding:.5em 1.1em .5em .6em;border-radius:3em;background:linear-gradient(90deg,rgba(30,20,8,.94),rgba(60,42,12,.94));border:.12em solid #c8a24a;box-shadow:0 .3em 1.2em rgba(0,0,0,.6),0 0 1.2em rgba(255,200,60,.3);animation:achin 3.6s ease forwards;min-width:18em}
#achpop .p.t3{border-color:#ffd23a;box-shadow:0 .3em 1.2em rgba(0,0,0,.6),0 0 2em rgba(255,210,60,.65)}
#achpop .p .h{font-size:.72em;color:#c8a870;font-weight:900;letter-spacing:.1em}
#achpop .p .nm{font-size:1.15em;font-weight:900;color:#fff2c0}
#achpop .p .pt{font-size:.8em;color:#ffd23a;font-weight:900;margin-left:auto;white-space:nowrap}
@keyframes achin{0%{opacity:0;transform:translateY(-1.2em) scale(.9)}8%{opacity:1;transform:translateY(0) scale(1.04)}12%{transform:scale(1)}85%{opacity:1}100%{opacity:0;transform:translateY(-.4em)}}
#menubar button.ach-dot{position:relative}
#menubar button.ach-dot::after{content:'';position:absolute;right:.3em;top:.3em;width:.55em;height:.55em;border-radius:50%;background:#ff3a3a;box-shadow:0 0 .4em #ff3a3a}
`);
const ACHW = { cat: 'all', filter: 'all' };
const achMedal = (A, off) => h('div', { class: 'ach-medal' + (off ? ' off' : ''), style: `background:radial-gradient(circle at 35% 30%,#fff8e0,${ACH_TIER[A.tier].col} 55%,${shade(ACH_TIER[A.tier].col, -0.45)})` }, ACH_TIER[A.tier].name);
Object.assign(menus, {
  w_achieve() {
    if (!save.data || !game.player) return null;
    achCheck();
    const el = itemWin('achieve', '成就', el => achRender(el), { w: 54 });
    el.classList.add('achw', 'sxw');
    return el;
  },
});
function achRender(el) {
  const d = achData(), X = achCtx(d), L = achList();
  const cnt = cat => { const A = L.filter(a => cat === 'all' || a.cat === cat); return [A.filter(a => d.done[a.id]).length, A.length, A.some(a => d.done[a.id] && !d.got[a.id] && achHasReward(a))]; };
  const cats = h('div', { class: 'acats' }, [['all', '总览'], ...ACH_CATS].map(([id, nm]) => { const [a, b, dot] = cnt(id); return h('div', { class: 'acat' + (ACHW.cat === id ? ' on' : ''), onclick: () => { ACHW.cat = id; sfx.click(); el._render(); } }, nm, dot ? h('span', { class: 'dot' }) : null, h('span', { class: 'n' }, `${a}/${b}`)); }));
  const main = h('div', { class: 'amain' });
  if (ACHW.cat === 'all') main.append(achOverview(el, d, L));
  else {
    const list = L.filter(A => A.cat === ACHW.cat).map(A => ({ A, P: achProgress(A, X) }))
      .filter(o => ACHW.filter === 'all' || (ACHW.filter === 'done' ? o.P.done : !o.P.done));
    const rank = o => (o.P.done && !o.P.got && achHasReward(o.A) ? 0 : o.P.done ? 2 : 1);
    list.sort((a, b) => rank(a) - rank(b) || (rank(a) === 1 ? b.P.v / b.P.n - a.P.v / a.P.n : (b.P.done || 0) - (a.P.done || 0)) || a.A.tier - b.A.tier);
    main.append(h('div', { class: 'row' }, h('div', { class: 'sxchips' }, [['all', '全部'], ['todo', '未完成'], ['done', '已完成']].map(([v, t]) => h('span', { class: 'sxchip' + (ACHW.filter === v ? ' on' : ''), onclick: () => { ACHW.filter = v; sfx.click(); el._render(); } }, t))),
      h('span', { class: 'sp' }), achClaimAllBtn(el, L.filter(A => A.cat === ACHW.cat))),
    h('div', { class: 'alist', 'data-sk': 'al' + ACHW.cat }, list.length ? list.map(o => achRow(el, o.A, o.P)) : h('div', { class: 'sxload' }, '没有符合条件的成就')));
  }
  return [h('div', { class: 'abody' }, cats, main)];
}
function achRow(el, A, P) {
  const d = achData(), claim = P.done && !P.got && achHasReward(A), secret = A.hidden && !P.done;
  const pct = Math.round(P.v / P.n * 100);
  return h('div', { class: 'arow' + (P.done ? ' done' : '') + (claim ? ' claim' : '') },
    achMedal(A, !P.done),
    h('div', { class: 't' }, h('div', { class: 'nm' }, secret ? '？？？' : A.name, A.online ? h('span', { class: 'tag', title: '需要登录联机才能推进' }, '联机') : null),
      h('div', { class: 'ds' }, secret ? '隐藏成就：达成后才会显示条件' : A.desc),
      P.done ? null : h('div', { class: 'abar' }, h('i', { style: `width:${pct}%` })),
      achHasReward(A) ? h('div', { class: 'rw' }, '奖励：', achRewardText(A)) : null),
    h('div', { class: 'side' }, h('span', { class: 'pt', style: `color:${ACH_TIER[A.tier].col}` }, `+${ACH_TIER[A.tier].pts} 点`),
      claim ? h('button', { class: 'btn sm', onclick: () => achDoClaim(el, [A.id]) }, '领取')
        : P.done ? h('span', { class: 'pv' }, `${P.got && achHasReward(A) ? '已领取 · ' : ''}${sxDate(P.done)}`)
        : h('span', { class: 'pv' }, `${fmtNum(P.v)} / ${fmtNum(P.n)}`)));
}
function achClaimAllBtn(el, list) {
  const d = achData(), ids = list.filter(A => d.done[A.id] && !d.got[A.id] && achHasReward(A)).map(A => A.id);
  return h('button', { class: 'btn sm' + (ids.length ? '' : ' off'), onclick: () => achDoClaim(el, ids) }, `一键领取${ids.length ? `（${ids.length}）` : ''}`);
}
function achDoClaim(el, ids) {
  const got = [];
  for (const id of ids) { const r = achClaim(id); if (r.err) { toastMsg(r.err, '#ff6a6a'); sfx.error(); break; } if (r.text) got.push(r.text); }
  if (got.length) {
    sfx.coin();
    const sum = new Map(); for (const t of got.flatMap(t => String(t).split('、'))) { const m = t.match(/^(.*?)\s*[×x]?\s*([\d,]+)$/), k = m ? m[1].trim() : t; sum.set(k, (sum.get(k) || 0) + (m ? +m[2].replace(/,/g, '') : 1)); }
    const txt = [...sum].map(([k, n]) => /点券|金币|G$/.test(k) ? `${k} ${fmtNum(n)}` : n > 1 ? `${k} ×${n}` : k).join('、');
    toastMsg(`领取了 ${ids.length} 个成就奖励：${txt.length > 60 ? txt.slice(0, 58) + '…' : txt}`, '#ffe8a8');
    if (txt.length > 60 && typeof ui !== 'undefined') ui.pushLog(`成就奖励：${txt}`, '#ffe8a8');
  }
  el._render();
}
function achOverview(el, d, L) {
  const pts = achPoints(d), total = L.reduce((s, A) => s + ACH_TIER[A.tier].pts, 0);
  const tiers = [1, 2, 3].map(t => { const A = L.filter(a => a.tier === t); return `${ACH_TIER[t].name} ${A.filter(a => d.done[a.id]).length}/${A.length}`; });
  const recent = L.filter(A => d.done[A.id]).sort((a, b) => d.done[b.id] - d.done[a.id]).slice(0, 8);
  return h('div', { class: 'ov', 'data-sk': 'ov' },
    h('div', { class: 'ovtop' }, h('div', {}, h('div', { class: 'small dim' }, '成就点'), h('div', { class: 'big' }, fmtNum(pts))),
      h('div', { style: 'flex:1' }, h('div', { class: 'abar', style: 'height:.7em' }, h('i', { style: `width:${Math.round(pts / total * 100)}%` })), h('div', { class: 'small', style: 'margin-top:.3em' }, `${fmtNum(pts)} / ${fmtNum(total)}　`, tiers.join('　'))),
      achClaimAllBtn(el, L)),
    h('div', { class: 'ovcats' }, ACH_CATS.map(([id, nm]) => { const A = L.filter(a => a.cat === id), n = A.filter(a => d.done[a.id]).length; return h('div', { class: 'ovcat', onclick: () => { ACHW.cat = id; sfx.click(); el._render(); } }, h('b', {}, nm, h('span', { class: 'small dim', style: 'float:right' }, `${n}/${A.length}`)), h('div', { class: 'abar' }, h('i', { style: `width:${Math.round(n / A.length * 100)}%` }))); })),
    h('div', { class: 'sxlbl' }, '最近达成'),
    h('div', { class: 'recent' }, recent.length ? recent.map(A => h('div', { class: 'r' }, achMedal(A), h('b', {}, A.name), h('span', { class: 'small dim' }, A.desc), h('span', { class: 'sp' }), h('span', { class: 'small dim' }, sxDate(d.done[A.id])))) : h('div', { class: 'small dim' }, '还没有达成任何成就，去地下城闯一闯吧！')),
    h('div', { class: 'ihint' }, '成就数据跟随角色；成就点会进排行榜（登录后）。标着“联机”的成就需要登录后和朋友一起玩才能推进。'));
}
/* ---- 达成弹窗 + 音效 ---- */
const achPop = { el: null, q: [], busy: 0 };
function achToast(A) {
  achPop.q.push(A);
  if (!achPop.el || !achPop.el.isConnected) { achPop.el = h('div', { id: 'achpop' }); dom.appendChild(achPop.el); }
  if (typeof ui !== 'undefined' && ui.pushLog) ui.pushLog(`成就达成：${A.name}（+${ACH_TIER[A.tier].pts} 成就点）`, ACH_TIER[A.tier].col);
  achPopNext();
}
function achPopNext() {
  if (achPop.busy >= 2 || !achPop.q.length) return;   // 同时最多 2 条，其余排队
  const A = achPop.q.shift(); achPop.busy++;
  const p = h('div', { class: 'p t' + A.tier }, achMedal(A), h('div', {}, h('div', { class: 'h' }, `成就达成 · ${ACH_TIER[A.tier].name}`), h('div', { class: 'nm' }, A.name)), h('div', { class: 'pt' }, `+${ACH_TIER[A.tier].pts} 成就点`));
  achPop.el.appendChild(p);
  if (A.tier === 3) sfx.epic(); else sfx.enhanceOk();
  p.addEventListener('animationend', () => { p.remove(); achPop.busy--; achPopNext(); });
}
/* ---- 入口：快捷键 U、菜单按钮“成就 / 公会”（插在商城那一行之前），有没领的奖励时按钮上亮红点 ---- */
sxAddKey('achieve', 'KeyU', '成就');
if (typeof MENUBAR !== 'undefined') {
  const i = MENUBAR.findIndex(b => b[0] === 'cash'), add = [['achieve', '成就'], ['guild', '公会']].filter(b => !MENUBAR.some(x => x[0] === b[0]));
  MENUBAR.splice(i >= 0 ? i : MENUBAR.length, 0, ...add);
}
setInterval(() => { const b = typeof menubar !== 'undefined' && menubar.btns && menubar.btns.achieve; if (!b || !save.data || !game.player) return; b.classList.toggle('ach-dot', achUnclaimed() > 0); }, 1500);
// 系统菜单（Esc，触屏也能打开）里加“成就”
{ const ws0 = menus.w_system; menus.w_system = function () { const el = ws0.apply(this, arguments); const col = el && el.querySelector('.sysmenu'); if (col && game.player) col.insertBefore(h('button', { class: 'btn', onclick: () => { sfx.click(); this.close('system'); this.show('achieve'); } }, '成就', h('span', { class: 'kbd' }, keyName('achieve'))), col.children[2] || null); return el; }; }
bus.on('achDone', () => { if (menus.isOpen('achieve')) { const el = menus.wins.achieve; if (el && el._render) el._render(); } });
