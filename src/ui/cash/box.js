/* =====================================================================
   开箱演出与商城的其他窗口（商城组）
   - boxopen：开箱演出（按最高品级分级：普通白光 → 稀有紫光 → 神器粉光 → 传说橙光 + 光柱 → 史诗金光全屏 + 光柱 + 震屏），十连一次展示 10 张牌依次翻开
     同一个浮层也用来展示“获得物品”（礼包、兑换、多买多送、抽奖）和天空套合成的成功 / 失败
   - synth：装扮合成器；lotto：破晓启示（不放回抽奖）；ticket：券的使用；pet：宠物窗口
   演出全部是 DOM + CSS 动画（不画在游戏画布上，不影响每帧绘制）
   ===================================================================== */
addStyle(`
.cbox-ov{position:absolute;inset:0;z-index:60;background:radial-gradient(ellipse at 50% 45%,rgba(30,16,40,.86),rgba(4,2,8,.95));display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1em;overflow:hidden;font-size:1.1em;color:#fff2d0}
.cbox-ov .ttl{font-size:1.5em;font-weight:900;letter-spacing:.1em;color:#ffe8a8;text-shadow:0 0 .4em rgba(0,0,0,.9)}
.cbox-ov .sub{font-size:.8em;color:#b8ac90;min-height:1.2em}
.cbox-stage{position:relative;width:24em;height:15em;display:grid;place-items:center}
.cbox-stage.ten{width:44em;height:19em}
.cbox-box{width:9em;height:9em;animation:cbShake .16s linear infinite;filter:drop-shadow(0 0 .8em var(--glow))}
.cbox-box.calm{animation:cbFloat 1.4s ease-in-out infinite}
@keyframes cbShake{0%,100%{transform:rotate(0) scale(1)}25%{transform:rotate(-7deg) scale(1.03)}75%{transform:rotate(7deg) scale(1.05)}}
@keyframes cbFloat{50%{transform:translateY(-.4em)}}
.cbox-glow{position:absolute;left:50%;top:50%;width:26em;height:26em;margin:-13em 0 0 -13em;border-radius:50%;background:radial-gradient(circle,var(--glow) 0,transparent 62%);opacity:.0;pointer-events:none;transition:opacity .6s}
.cbox-glow.on{opacity:.55}
.cbox-rays{position:absolute;left:50%;top:50%;width:60em;height:60em;margin:-30em 0 0 -30em;border-radius:50%;background:repeating-conic-gradient(from 0deg,var(--ray) 0deg 7deg,transparent 7deg 20deg);-webkit-mask:radial-gradient(circle,#000 0,transparent 60%);mask:radial-gradient(circle,#000 0,transparent 60%);animation:cbRays 14s linear infinite;opacity:.55;pointer-events:none}
@keyframes cbRays{to{transform:rotate(360deg)}}
.cbox-burst{position:absolute;left:50%;top:50%;width:14em;height:14em;margin:-7em 0 0 -7em;border-radius:50%;background:radial-gradient(circle,#fff 0,var(--glow) 35%,transparent 70%);animation:cbBurst .7s ease-out forwards;pointer-events:none}
@keyframes cbBurst{from{transform:scale(.2);opacity:1}to{transform:scale(3.2);opacity:0}}
.cbox-flash{position:absolute;inset:0;background:var(--glow);animation:cbFlash .9s ease-out forwards;pointer-events:none}
@keyframes cbFlash{from{opacity:.9}to{opacity:0}}
.cbox-ov.quake{animation:cbQuake .5s linear}
@keyframes cbQuake{0%,100%{transform:none}20%{transform:translate(-.5em,.2em)}40%{transform:translate(.5em,-.3em)}60%{transform:translate(-.3em,.3em)}80%{transform:translate(.3em,-.1em)}}
.cbox-card{position:relative;width:13em;padding:1em .8em .8em;border-radius:.5em;text-align:center;background:linear-gradient(#2a2032,#120d16);border:.14em solid var(--glow);box-shadow:0 0 1.4em var(--glow),inset 0 0 1em rgba(255,255,255,.06);animation:cbPop .5s cubic-bezier(.2,1.6,.4,1) both}
@keyframes cbPop{0%{transform:scale(.3);opacity:0}100%{transform:scale(1);opacity:1}}
.cbox-card img{width:6em;height:6em}
.cbox-card .nm{font-weight:900;font-size:1.1em;margin-top:.3em;line-height:1.25}
.cbox-card .rk{font-size:.75em;color:var(--glow);font-weight:900;letter-spacing:.2em}
.cbox-card .jp{position:absolute;top:-.8em;left:50%;transform:translateX(-50%);background:linear-gradient(90deg,#d8283a,#ffb400);color:#fff;font-weight:900;font-size:.7em;padding:.1em .8em;border-radius:1em;white-space:nowrap}
.cbox-grid{display:grid;grid-template-columns:repeat(5,8em);gap:.7em;perspective:60em}
.cbox-grid.many{grid-template-columns:repeat(6,6.6em)}
.cbox-t{position:relative;height:10.5em;transform-style:preserve-3d;transition:transform .45s}
.cbox-grid.many .cbox-t{height:8.6em}
.cbox-t.hide{transform:rotateY(180deg)}
.cbox-t>div{position:absolute;inset:0;backface-visibility:hidden;border-radius:.4em;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.25em;padding:.3em;text-align:center}
.cbox-t .fr{background:linear-gradient(#2a2032,#120d16);border:.12em solid var(--glow);box-shadow:0 0 .9em var(--glow)}
.cbox-t .fr img{width:4.2em;height:4.2em}
.cbox-grid.many .cbox-t .fr img{width:3.4em;height:3.4em}
.cbox-stage.ten.big{height:25em}
.cbox-grid.huge{grid-template-columns:repeat(10,4.1em);gap:.35em;max-height:25em;overflow-y:auto;padding:.3em}
.cbox-grid.huge .cbox-t{height:5.8em}
.cbox-grid.huge .cbox-t .fr{box-shadow:0 0 .45em var(--glow)}
.cbox-grid.huge .cbox-t .fr img{width:2.6em;height:2.6em}
.cbox-grid.huge .cbox-t .fr .nm{font-size:.56em}
.cbox-t .fr .nm{font-size:.72em;font-weight:900;line-height:1.2}
.cbox-t .bk{transform:rotateY(180deg);background:linear-gradient(135deg,#5a2a6a,#2a1238 50%,#5a2a6a);border:.12em solid #c89a3a;box-shadow:inset 0 0 1em rgba(255,210,120,.25)}
.cbox-t .bk b{font-size:2.4em;color:#ffd23a;text-shadow:0 0 .3em #000}
.cbox-t.tease .bk{box-shadow:0 0 1.2em var(--glow),inset 0 0 1em var(--glow);animation:cbTease .5s ease-in-out infinite}
@keyframes cbTease{50%{transform:rotateY(180deg) scale(1.05)}}
.cbox-foot{display:flex;gap:.6em;flex-wrap:wrap;justify-content:center}
.cbox-foot .btn{min-width:7em}
.cbox-foot .btn.buy{background:linear-gradient(180deg,#c83a7a,#7a1a4a);border-color:#ff8ac8}
.csy{display:grid;grid-template-columns:1fr 1fr;gap:.6em}
.csy .col{gap:.35em}
.csy .h{color:#e8c26a;font-weight:900;font-size:.86em}
.csy-pick{display:flex;gap:.3em;flex-wrap:wrap}
.csy-pick span{padding:.15em .6em;border-radius:1em;border:.08em solid #4a3c2c;cursor:pointer;font-size:.8em;color:#b8a888;background:#18121e}
.csy-pick span.on{background:#5a4424;color:#ffe8a8;border-color:#a88450}
.csy-in{display:flex;gap:.3em;flex-wrap:wrap;padding:.4em;background:#0b090e;border:.1em solid #3a3040;border-radius:.25em;min-height:3.8em}
.csy-rate{font-size:1.2em;font-weight:900;color:#ffd23a}
.csy-list{max-height:13em;overflow-y:auto;overflow-x:hidden;align-content:start;padding-right:.2em}
.clotto{display:grid;grid-template-columns:repeat(5,1fr);gap:.35em}
.clot{position:relative;background:linear-gradient(#241b2a,#140f18);border:.1em solid #3a3040;border-radius:.3em;padding:.35em .2em;text-align:center;font-size:.72em;min-height:6.2em;display:flex;flex-direction:column;align-items:center;gap:.15em}
.clot img{width:3em;height:3em}
.clot.star{border-color:#c8a03a;box-shadow:inset 0 0 .6em rgba(255,200,60,.25)}
.clot.got{opacity:.35}
.clot.got::after{content:'已获得';position:absolute;top:40%;left:50%;transform:translate(-50%,-50%) rotate(-18deg);border:.15em solid #ff5a5a;color:#ff5a5a;font-weight:900;padding:0 .4em;border-radius:.2em;font-size:1.2em}
.clot.hot{border-color:#fff;box-shadow:0 0 1em #ffd23a;transform:scale(1.06)}
.cpet{display:flex;gap:.7em;align-items:flex-start}
.cpet .pv{width:14em;height:10em;border-radius:.3em;background:radial-gradient(ellipse at 50% 75%,#3a2c48,#120d16 70%);display:grid;place-items:center}
.cpet .pv canvas{width:100%;height:100%}
.cpet .slots{display:grid;grid-template-columns:repeat(2,auto);gap:.35em .5em;align-items:center;font-size:.8em}
.cpet .slots .islot{width:3.3em;height:3.3em}
.ctk-list{max-height:16em}
`);
const CB_TIER = [
  { col: '#e8f0ff', name: '普通' }, { col: '#9ae8ff', name: '高级' }, { col: '#b36bff', name: '稀有' },
  { col: '#ff55ff', name: '神器' }, { col: '#ff8a1a', name: '传说' }, { col: '#ffb400', name: '史诗' },
];
const cbTier = r => CB_TIER[clamp(r | 0, 0, 5)];
const cbSnd = {
  shake() { for (let i = 0; i < 5; i++) sfx.tone('square', 180 + i * 30, 120, 0.05, 0.03, { delay: i * 0.13 }); },
  reveal(r) {
    if (r >= 5) { sfx.epic(); sfx.boom(0.6); }
    else if (r >= 4) { sfx.levelUp(); sfx.tone('sine', 90, 50, 0.6, 0.3); }
    else if (r >= 3) sfx.enhanceOk();
    else if (r >= 2) [0, 5, 9].forEach((s, i) => sfx.tone('triangle', 660 * Math.pow(2, s / 12), 0, 0.2, 0.08, { delay: i * 0.06 }));
    else sfx.pickup();
  },
  flip(r) { sfx.tone('triangle', 700 + r * 140, (700 + r * 140) * 1.4, 0.09, 0.07); if (r >= 4) sfx.tone('sine', 1400 + r * 100, 0, 0.35, 0.06, { delay: 0.05 }); },
};
const cbItemName = it => `${it.name}${it.n > 1 ? ' ×' + fmtNum(it.n) : ''}`;
const cbIcon = (it, s = 96) => it.kind === 'gold' ? itemIconSrc({ key: 'gold', kind: 'use', rar: it.rar }, s) : itemIconSrc(it, s);
/* ---- 开箱入口（背包右键、商城“买下并打开”） ---- */
function cashBoxUI(key, count = 1) {
  if (CASH_SELECT[key]) { menus.show('ticket', { select: key }); return false; }
  const res = cashOpenBoxes(key, count);
  if (res.err) { toastMsg(res.err, '#ff6a6a'); sfx.error(); return false; }
  cashOverlay({ mode: 'box', key, res });
  itemsRefresh();
  return true;
}
// 大量开箱（百连）：同名同品级合并成一格 ×数量，品级高的在前，全部列出（格子区可滚动）；下面一行按品级汇总
function cbMany(stage, sub, items) {
  const G = new Map();
  for (const it of items) { const k = `${it.key}|${it.rar || 0}|${cbItemName(it)}`; const g = G.get(k); if (g) g.n += it.n || 1; else G.set(k, { it, n: it.n || 1 }); }
  const list = [...G.values()].sort((a, b) => (b.it.rar || 0) - (a.it.rar || 0) || b.n - a.n);
  stage.classList.add('ten', 'big');
  const g = h('div', { class: 'cbox-grid huge' });
  for (const { it, n } of list) g.append(h('div', { class: 'cbox-t', style: `--glow:${cbTier(it.rar).col}` }, h('div', { class: 'fr' }, h('img', { src: cbIcon(it, 96) }), h('div', { class: `nm q${Math.min(5, it.rar || 0)}` }, cbItemName(it) + (n > 1 ? ` ×${n}` : '')))));
  stage.append(g);
  const by = {}; for (const it of items) by[it.rar || 0] = (by[it.rar || 0] || 0) + 1;
  const RN = ['普通', '高级', '稀有', '神器', '传说', '史诗'];
  sub.textContent = `共 ${items.length} 件（全部已放进背包）：` + Object.keys(by).sort((a, b) => b - a).map(r => `${RN[Math.min(5, r)]} ${by[r]}`).join(' · ') + (list.length > 30 ? '（往下滚动看全部）' : '');
}
// 获得物品一览（礼包 / 兑换 / 多买多送 / 抽奖）
function cashShowGot(title, items) { if (!items || !items.length) return; cashOverlay({ mode: 'got', title, items }); }
function cashOverlay(o) {
  if (menus.isOpen('boxopen')) menus.close('boxopen');
  menus.open('boxopen', o);
}
Object.assign(menus, {
  w_boxopen(o) {
    const items = o.mode === 'box' ? o.res.results.flatMap(R => R.items) : o.mode === 'synth' ? [o.item] : o.items;
    const best = items.reduce((m, it) => Math.max(m, it.rar || 0), 0), T = cbTier(best);
    const jackIdx = new Set(); if (o.mode === 'box') { let i = 0; for (const R of o.res.results) { for (const it of R.items) { if (R.jackpot) jackIdx.add(i); i++; } } }
    const el = h('div', { class: 'cbox-ov', 'data-block': '1', 'data-hud': 'hide', style: `--glow:${T.col};--ray:${T.col}55` });
    const D = o.key && ITEMS[o.key];
    const ttl = h('div', { class: 'ttl' }, o.mode === 'box' ? `打开${D.name}${items.length > 1 && o.res.results.length > 1 ? ` ×${o.res.results.length}` : ''}` : o.mode === 'synth' ? (o.ok ? '合成成功！' : '合成失败') : o.title || '获得物品');
    const sub = h('div', { class: 'sub' }, '');
    const stage = h('div', { class: 'cbox-stage' });
    const foot = h('div', { class: 'cbox-foot' });
    el.append(ttl, stage, sub, foot);
    const timers = []; const later = (ms, fn) => timers.push(setTimeout(() => { if (el.isConnected) fn(); }, ms));
    el._cleanup = () => timers.forEach(clearTimeout);
    const fx = r => {   // 按品级的光效：光晕 → 爆光 → 光柱（传说以上）→ 全屏闪光 + 震屏（史诗）
      const t = cbTier(r); el.style.setProperty('--glow', t.col); el.style.setProperty('--ray', t.col + '55');
      stage.append(h('div', { class: 'cbox-burst' }));
      if (r >= 4) stage.prepend(h('div', { class: 'cbox-rays' }));
      if (r >= 5) { el.append(h('div', { class: 'cbox-flash' })); el.classList.remove('quake'); void el.offsetWidth; el.classList.add('quake'); }
      cbSnd.reveal(r);
    };
    const card = (it, jp) => h('div', { class: 'cbox-card', style: `--glow:${cbTier(it.rar).col}` }, jp ? h('span', { class: 'jp' }, '大奖') : null, h('img', { src: cbIcon(it, 128) }), h('div', { class: `nm q${Math.min(5, it.rar || 0)}` }, cbItemName(it)), h('div', { class: 'rk' }, cbTier(it.rar).name));
    const done = () => {
      foot.replaceChildren(h('button', { class: 'btn', onclick: () => { sfx.click(); menus.close('boxopen'); } }, '确定'));
      if (o.mode === 'box') {
        const left = inv.count(o.key);
        if (left > 0) foot.append(h('button', { class: 'btn buy', onclick: () => { sfx.click(); cashBoxUI(o.key, 1); } }, `再开 1 个（剩 ${left}）`));
        if (left >= 10 && !CASH_BOXES[o.key].rolls) foot.append(h('button', { class: 'btn buy', onclick: () => { sfx.click(); cashBoxUI(o.key, 10); } }, '十连'));
        if (left >= 100 && !CASH_BOXES[o.key].rolls) foot.append(h('button', { class: 'btn buy', onclick: () => { sfx.click(); cashBoxUI(o.key, 100); } }, '百连'));
        if (o.key === 'box_magic') { const pg = cashGoods('box_magic'); if (left === 0 && cashBal('cera') >= pg.price) foot.append(h('button', { class: 'btn buy', onclick: () => { sfx.click(); const r = cashBuy('box_magic', 1); if (r.err) { toastMsg(r.err, '#ff6a6a'); return; } cashBoxUI('box_magic', 1); } }, `买 1 个再开（${pg.price} 点券）`)); }
        const S = cashData(); if (o.key === 'box_magic' || o.key === 'box_magic2') sub.textContent = `${o.res.results.some(R => R.forced) ? '保底触发！第 100 次必出大奖 · ' : ''}魔盒碎片 +${o.res.shards}（共 ${cashBal('shard')}）· 保底进度 ${S.pity.box_magic || 0}/100`;
      }
      el._onConfirm = () => menus.close('boxopen');
    };
    if (o.mode === 'got' || o.mode === 'synth') {
      if (items.length === 1 || o.mode === 'synth') {
        stage.append(h('div', { class: 'cbox-glow on' }));
        if (o.mode === 'synth' && !o.ok) { el.style.setProperty('--glow', '#8a8a9a'); stage.append(card(items[0])); sfx.enhanceFail(); sub.textContent = `这次没有成功……得到了 1 件随机的同部位高级装扮（成功率 ${Math.round(o.rate * 100)}%）`; }
        else { stage.append(card(items[0])); fx(o.mode === 'synth' ? 5 : best); if (o.mode === 'synth') sub.textContent = '稀有装扮（天空）！已发出全服公告'; }
      } else if (items.length > 18) { cbMany(stage, sub, items); if (best >= 3) fx(best); else cbSnd.reveal(best); }
      else {
        stage.classList.add('ten');
        const g = h('div', { class: 'cbox-grid' + (items.length > 10 ? ' many' : '') });
        for (const it of items.slice(0, 18)) g.append(h('div', { class: 'cbox-t', style: `--glow:${cbTier(it.rar).col}` }, h('div', { class: 'fr' }, h('img', { src: cbIcon(it, 96) }), h('div', { class: `nm q${Math.min(5, it.rar || 0)}` }, cbItemName(it)))));
        stage.append(g); if (items.length > 18) sub.textContent = `……等共 ${items.length} 件`;
        if (best >= 3) fx(best); else cbSnd.reveal(best);
      }
      done(); return el;
    }
    // 开箱：先摇箱子，再按品级开出
    const boxImg = h('img', { class: 'cbox-box', src: cbIcon(D ? { ...D, key: o.key } : items[0], 160) });
    const glow = h('div', { class: 'cbox-glow' });
    stage.append(glow, boxImg);
    const skip = h('button', { class: 'btn blue', onclick: () => reveal(true) }, '跳过');
    foot.append(skip);
    cbSnd.shake();
    later(350, () => glow.classList.add('on'));
    let revealed = false;
    const reveal = fast => {
      if (revealed) return; revealed = true;
      timers.forEach(clearTimeout);
      stage.replaceChildren();
      if (items.length === 1) { stage.append(h('div', { class: 'cbox-glow on' }), card(items[0], jackIdx.has(0))); fx(best); done(); return; }
      if (items.length > 18) { cbMany(stage, sub, items); if (best >= 3) fx(best); else cbSnd.reveal(best); done(); return; }   // 百连：合并同名 + 数量，按品级排，一次亮出
      stage.classList.add('ten');
      const g = h('div', { class: 'cbox-grid' + (items.length > 10 ? ' many' : '') }), tiles = [];
      items.slice(0, 18).forEach((it, i) => { const t = h('div', { class: 'cbox-t hide', style: `--glow:${cbTier(it.rar).col}` }, h('div', { class: 'fr' }, jackIdx.has(i) ? h('span', { class: 'jp', style: 'position:absolute;top:.2em;font-size:.6em;background:#d8283a;padding:0 .4em;border-radius:1em' }, '大奖') : null, h('img', { src: cbIcon(it, 96) }), h('div', { class: `nm q${Math.min(5, it.rar || 0)}` }, cbItemName(it))), h('div', { class: 'bk' }, h('b', {}, '?'))); tiles.push([t, it]); g.append(t); });
      stage.append(g);
      if (items.length > 18) sub.textContent = `……等共 ${items.length} 件（全部已放进背包）`;
      const flipAll = () => { for (const [t] of tiles) t.classList.remove('hide', 'tease'); if (best >= 3) fx(best); else cbSnd.reveal(best); done(); };
      if (fast) { flipAll(); return; }
      // 逐张翻开：好东西先“发光预告”一下再翻
      foot.replaceChildren(h('button', { class: 'btn blue', onclick: () => { timers.forEach(clearTimeout); flipAll(); } }, '全部翻开'));
      let at = 250;
      tiles.forEach(([t, it]) => { if (it.rar >= 3) { later(at, () => t.classList.add('tease')); at += 420; } later(at, () => { t.classList.remove('hide', 'tease'); cbSnd.flip(it.rar || 0); }); at += 170; });
      later(at + 250, () => { if (best >= 3) fx(best); done(); });
    };
    later(o.res.results.length > 1 ? 800 : 1000, () => reveal(false));
    el._onConfirm = () => reveal(true);
    return el;
  },
});
{ const close0 = menus.close; menus.close = function (name) { const el = this.wins[name]; if (name === 'boxopen' && el && el._cleanup) el._cleanup(); return close0.apply(this, arguments); }; }

/* ---- 装扮合成器 ---- */
const CSY = { synth: 'synth_basic', set: 'av_sky1', slot: 'av_top', opt: null, ins: [] };
Object.assign(menus, {
  w_synth(arg = {}) {
    if (arg.key && ITEMS[arg.key] && ITEMS[arg.key].synth) CSY.synth = arg.key;
    if (arg.set) CSY.set = arg.set;
    CSY.ins = [];
    const el = itemWin('synth', '装扮合成器', el => {
      const Y = ITEMS[CSY.synth].synth, pool = cashSynthPool();
      CSY.ins = CSY.ins.filter(it => pool.includes(it));
      const slot = Y.any ? CSY.slot : CSY.ins[0] ? CSY.ins[0].slot : null;
      const choices = pool.filter(it => !CSY.ins.includes(it) && (Y.any || !slot || it.slot === slot));
      const pick = (arr, cur, set) => h('div', { class: 'csy-pick' }, arr.map(([id, nm]) => h('span', { class: id === cur ? 'on' : '', onclick: () => { set(id); sfx.click(); el._render(); } }, nm)));
      const synths = ['synth_basic', 'synth_gold', 'synth_dream'].map(k => [k, `${ITEMS[k].name}（${inv.count(k)}）`]);
      const inBox = h('div', { class: 'csy-in' });
      for (let i = 0; i < Y.need; i++) { const it = CSY.ins[i]; inBox.append(itemSlot(it || null, { label: it ? '' : '放入', cmp: false, onClick: () => { if (it) { CSY.ins.splice(i, 1); sfx.click(); el._render(); } } })); }
      const list = h('div', { class: 'igrid csy-list', 'data-sk': 'sy' });
      for (const it of choices) list.append(itemSlot(it, { cmp: false, onClick: () => { if (CSY.ins.length < Y.need) { CSY.ins.push(it); sfx.click(); el._render(); } } }));
      if (!choices.length) list.append(h('div', { class: 'dim small', style: 'grid-column:1/-1;padding:.6em' }, pool.length ? '没有更多符合条件的高级装扮了' : '背包里没有高级装扮（穿着的要先脱下）。可以在商城买“高级装扮随机礼盒”。'));
      const T = slot ? cashAvOpts(ITEMS[avKey(CSY.set, slot)]) : null;
      if (T && !T.some(o => o[0] === CSY.opt)) CSY.opt = T[0][0];
      const ready = CSY.ins.length === Y.need && inv.count(CSY.synth) > 0 && (!Y.any || slot);
      const left = h('div', { class: 'col' },
        h('div', { class: 'h' }, '① 合成器'), pick(synths, CSY.synth, v => { CSY.synth = v; CSY.ins = []; }),
        h('div', { class: 'h' }, '② 目标天空套'), pick(CASH_SKY_SETS.map(s => [s, CASH_SETS[s].name]), CSY.set, v => { CSY.set = v; }),
        (() => { const miss = cashSkyState(CSY.set).filter(s => s.st === 'miss'); return h('div', { class: 'small', style: 'color:#c8b890' }, `已收集 ${8 - miss.length}/8`, miss.length ? h('span', { style: 'color:#ffd23a' }, ` · 缺：${miss.map(s => SLOT_NAME[s.slot]).join('、')}`) : h('span', { style: 'color:#6aff7a' }, ' · 已集齐')); })(),
        Y.any ? h('div', { class: 'h' }, '③ 指定部位') : null, Y.any ? pick(AV_PIECE_SLOTS.map(s => [s, SLOT_NAME[s]]), CSY.slot, v => { CSY.slot = v; }) : null,
        h('div', { class: 'h' }, `${Y.any ? '④' : '③'} 放入${Y.need} 件${Y.any ? '任意' : '同部位的'}高级装扮`), inBox,
        T ? h('div', { class: 'h' }, '成品属性') : null,
        T ? (() => { const s = h('select', {}, T.map(([k, v]) => h('option', { value: k }, statLine(k, v)))); s.value = CSY.opt; s.addEventListener('change', () => { CSY.opt = s.value; }); s.style.cssText = 'font-family:inherit;background:#0c0a10;color:#fff2d0;border:.08em solid #6a5436;border-radius:.2em;padding:.15em'; return s; })() : null);
      const right = h('div', { class: 'col' },
        h('div', { class: 'h' }, '背包里的高级装扮（点击放入）'), list,
        h('div', { class: 'row', style: 'gap:.5em;align-items:center' }, h('span', { class: 'csy-rate' }, `成功率 ${Math.round(Y.rate * 100)}%`),
          h('span', { class: 'cash-note' }, Y.rate < 1 ? '失败时得到 1 件随机的同部位高级装扮' : '必定成功')),
        h('div', { class: 'row', style: 'gap:.4em' },
          h('button', { class: 'btn' + (ready ? '' : ' off'), style: ready ? 'background:linear-gradient(180deg,#c83a7a,#7a1a4a);border-color:#ff8ac8' : 'opacity:.45;pointer-events:none', onclick: () => {
            const r = cashSynth({ synth: CSY.synth, inputs: CSY.ins, set: CSY.set, slot: CSY.slot, opt: CSY.opt });
            if (r.err) { toastMsg(r.err, '#ff6a6a'); sfx.error(); return; }
            CSY.ins = []; itemsRefresh(); cashOverlay({ mode: 'synth', ok: r.ok, item: r.item, rate: r.rate });
          } }, '合成'),
          inv.count(CSY.synth) ? null : h('button', { class: 'btn sm blue', onclick: () => { sfx.click(); menus.show('cash', { tab: 'sky' }); } }, '购买合成器')),
        // 自动放入 / 一键合成：自动找能配对的部位，优先合目标天空套还没有的部位
        h('div', { class: 'row', style: 'gap:.4em;align-items:center;flex-wrap:wrap;margin-top:.2em' },
          h('button', { class: 'btn sm', onclick: () => {
            const P = cashSynthAutoPick(CSY.synth, CSY.set, CSY.skip !== false);
            if (!P) { toastMsg(Y.any ? `背包里的高级装扮不足 ${Y.need} 件，或目标天空套已经集齐` : '没有能配对的部位（需要 2 件同部位的高级装扮；已有天空套的部位会跳过）', '#ffb0a0'); sfx.error(); return; }
            CSY.ins = P.inputs; if (Y.any) CSY.slot = P.slot; sfx.click(); el._render();
          } }, '自动放入'),
          (() => {
            const n = inv.count(CSY.synth), P = cashSynthAutoPick(CSY.synth, CSY.set, CSY.skip !== false);
            return h('button', { class: 'btn sm' + (n && P ? '' : ' off'), style: n && P ? 'border-color:#ffd23a;color:#ffe070' : 'opacity:.45', onclick: () => {
              if (!n || !P) { toastMsg(n ? '没有能配对的高级装扮了' : `没有${ITEMS[CSY.synth].name}`, '#ffb0a0'); sfx.error(); return; }
              menus.ask({ title: '一键合成', okText: '开始合成', text: `用手上的 <b style="color:#ffd23a">${ITEMS[CSY.synth].name} ×${n}</b> 连续合成「${CASH_SETS[CSY.set].name}」，每次 ${Y.need} 件高级装扮，优先合还没有的部位${CSY.skip !== false ? '，已有天空的部位跳过' : ''}。<br><span class="small dim">合成失败退回的高级装扮会继续参与；装扮不够配对时自动停止。身上穿着的装扮不会动。</span>`,
                ok: () => {
                  const r = cashSynthBatch(CSY.synth, CSY.set, { skipOwned: CSY.skip !== false, opt: CSY.opt });
                  CSY.ins = []; itemsRefresh();
                  if (!r.n) { toastMsg('没有进行合成', '#ffb0a0'); return; }
                  toastMsg(`一键合成：共 ${r.n} 次，成功 ${r.ok} 次`, r.ok ? '#ffd23a' : '#e8dcc0');
                  if (r.got.length) cashShowGot(`一键合成 · 成功 ${r.ok}/${r.n}`, r.got); else sfx.card();
                } });
            } }, `一键合成（合成器 ${n}）`);
          })(),
          h('label', { class: 'small', style: 'display:flex;align-items:center;gap:.25em;cursor:pointer;color:#c8b890', onclick: e => { e.preventDefault(); CSY.skip = CSY.skip === false; sfx.click(); el._render(); } }, itemCheckBox(CSY.skip !== false, () => {}), '已有天空的部位跳过')));
      const S = cashData().synth;
      return [h('div', { class: 'csy' }, left, right), h('div', { class: 'ihint' }, `官方规则：2 件同部位高级装扮合成稀有装扮（天空）；梦想合成器用任意 8 件保底。${S ? `已合成 ${S.n} 次，成功 ${S.ok} 次。` : ''}`)];
    }, { w: 44, at: 'center' });
    el.dataset.block = '1';
    return el;
  },
});

/* ---- 破晓启示：不放回抽奖 ---- */
Object.assign(menus, {
  w_lotto() {
    const el = itemWin('lotto', '破晓启示 · 不放回抽奖', el => {
      const st = cashLottoState(), grid = h('div', { class: 'clotto' });
      CASH_LOTTO.forEach((R, i) => {
        const k = R.key, D = ITEMS[k];
        grid.append(h('div', { class: 'clot' + (R.star ? ' star' : '') + (st.got.includes(i) ? ' got' : ''), 'data-i': i }, D ? h('img', { src: cashIconOf(k, 64) }) : null, h('span', { class: 'q' + cashRewardRar(R) }, cashRewardName(R)), R.star ? h('b', { style: 'color:#ffd23a' }, '★ 大奖') : null));
      });
      const empty = st.left === 0, claimed = cashData().lotto.done > st.resets;
      const draw = () => {
        const r = cashLottoDraw(); if (r.err) { toastMsg(r.err, '#ff6a6a'); sfx.error(); return; }
        // 轮盘：在剩下的格子里跳动，最后停在抽中的那格
        const cells = [...el.querySelectorAll('.clot')].filter(c => !c.classList.contains('got') || +c.dataset.i === r.i);
        let n = 0; const steps = 14 + Math.floor(Math.random() * 6);
        const tick = () => {
          cells.forEach(c => c.classList.remove('hot'));
          const c = n >= steps ? cells.find(c => +c.dataset.i === r.i) : cells[n % cells.length];
          if (c) c.classList.add('hot'); sfx.tone('triangle', 900 + (n % 5) * 60, 0, 0.04, 0.05);
          if (n++ < steps) setTimeout(tick, 50 + n * 7); else setTimeout(() => { itemsRefresh(); if (CASH_LOTTO[r.i].star || r.items.some(it => it.rar >= 4)) cashShowGot('破晓启示', r.items); else { sfx.card(); toastMsg(`破晓启示：获得 ${r.items.map(cbItemName).join('、')}`, '#ffd23a'); } }, 350);
        };
        tick();
      };
      return [h('div', { class: 'cash-top' }, h('span', { class: 'cash-cur gcoin' }, `抽奖券 ${st.tickets}`), h('span', { class: 'cash-note' }, `奖池剩余 ${st.left}/${CASH_LOTTO.length} · 已重置 ${st.resets}/${CASH_LOTTO_RESETS} 次`), h('span', { class: 'sp' }),
        h('button', { class: 'btn sm blue', onclick: () => { sfx.click(); menus.show('cashx', { tab: 'gcoin' }); } }, '礼包币换抽奖券')),
        grid,
        h('div', { class: 'row', style: 'gap:.5em;justify-content:center;margin-top:.3em' },
          empty ? null : h('button', { class: 'btn' + (st.tickets ? '' : ' off'), style: 'background:linear-gradient(180deg,#c83a7a,#7a1a4a);border-color:#ff8ac8' + (st.tickets ? '' : ';opacity:.45;pointer-events:none'), onclick: () => { sfx.click(); draw(); } }, '抽 1 次（消耗 1 张抽奖券）'),
          empty && !claimed ? h('button', { class: 'btn', onclick: () => { const r = cashLottoClaim(); if (r.err) { toastMsg(r.err, '#ff6a6a'); return; } cashShowGot('奖池抽空 · 完成奖励', r.items); itemsRefresh(); } }, '领取完成奖励') : null,
          empty && claimed && st.resets < CASH_LOTTO_RESETS ? h('button', { class: 'btn blue', onclick: () => { const r = cashLottoReset(); if (r.err) toastMsg(r.err, '#ff6a6a'); else { sfx.open(); toastMsg('奖池已重置', '#bfe8ff'); } itemsRefresh(); } }, '重置奖池') : null),
        h('div', { class: 'ihint' }, `官方式不放回抽奖：抽过的奖励不会再出现，20 次必定抽空；抽空后领取完成奖励（${CASH_LOTTO_DONE.map(cashRewardName).join('、')}），可以重置奖池（最多 ${CASH_LOTTO_RESETS} 次）。每个节日礼包附赠 2 张抽奖券。`)];
    }, { w: 40, at: 'center' });
    el.dataset.block = '1';
    return el;
  },
});

/* ---- 券的使用 / 自选礼盒 ---- */
const CTK = { target: null, set: null, slot: 'av_top', opt: null, stat: null };
Object.assign(menus, {
  w_ticket(arg = {}) {
    CTK.target = null; CTK.set = null; CTK.opt = null;
    const el = itemWin('ticket', arg.select ? ITEMS[arg.select].name : ITEMS[arg.key].name, el => {
      // 自选礼盒
      if (arg.select) {
        const keys = cashSelectKeys(arg.select), list = h('div', { class: 'igrid ctk-list', 'data-sk': 'tk' });
        for (const k of keys) list.append(itemSlot(makeItem(k), { cmp: true, sel: CTK.target === k, onClick: () => { CTK.target = k; sfx.click(); el._render(); } }));
        return [h('div', { class: 'cash-note' }, keys.length ? '选择 1 件（鼠标悬停看属性）：' : '现在没有可以选的物品（等级再高一点再来）。'), list,
          h('div', { class: 'row', style: 'gap:.4em' }, h('button', { class: 'btn' + (CTK.target ? '' : ' off'), style: CTK.target ? '' : 'opacity:.45;pointer-events:none', onclick: () => {
            const r = cashOpenSelect(arg.select, CTK.target); if (r.err) { toastMsg(r.err, '#ff6a6a'); sfx.error(); return; }
            menus.close('ticket'); itemsRefresh(); cashShowGot(ITEMS[arg.select].name, r.results[0].items);
          } }, '确定选择'))];
      }
      const tk = inv.items.find(x => x.key === arg.key), T = ITEMS[arg.key].ticket;
      if (!tk) return [h('div', { class: 'dim' }, '券已经用完了')];
      if (T.kind === 'enh' || T.kind === 'amp') {
        const targets = cashTicketTargets(T), list = h('div', { class: 'igrid ctk-list', 'data-sk': 'tk' });
        for (const it of targets) list.append(itemSlot(it, { cmp: false, sel: CTK.target === it, onClick: () => { CTK.target = it; sfx.click(); el._render(); } }));
        const statSel = T.kind === 'amp' && CTK.target && !CTK.target.dim ? (() => { const s = h('select', {}, [['str', '力量'], ['int', '智力'], ['vit', '体力'], ['spr', '精神']].map(([k, n]) => h('option', { value: k }, `异次元属性：${n}`))); s.value = CTK.stat || (game.player.cls === 'mage' ? 'int' : 'str'); CTK.stat = s.value; s.addEventListener('change', () => { CTK.stat = s.value; }); return s; })() : null;
        return [h('div', { class: 'cash-note' }, `${ITEMS[arg.key].desc}${T.kind === 'amp' && typeof ampSetLevel !== 'function' ? '（增幅系统还没开放）' : ''}`), list,
          targets.length ? null : h('div', { class: 'dim small' }, '身上和背包里没有可以使用的装备'), statSel,
          h('div', { class: 'row', style: 'gap:.4em' }, h('button', { class: 'btn' + (CTK.target ? '' : ' off'), style: CTK.target ? '' : 'opacity:.45;pointer-events:none', onclick: () => {
            const r = cashUseTicket(tk, CTK.target, { stat: CTK.stat }); if (r.err) { toastMsg(r.err, '#ff6a6a'); sfx.error(); return; }
            toastMsg(`${CTK.target.name} ${T.kind === 'amp' ? '增幅' : '强化'}到了 +${T.lvl}！`, '#ffd23a'); menus.close('ticket'); itemsRefresh();
            if (T.lvl >= 10) toastMsg(`【公告】勇士 ${save.data.name} 使用${ITEMS[arg.key].name}，将 ${CTK.target.name} 变为 +${T.lvl}！`, '#ffd23a');
          } }, `使用（变为 +${T.lvl}）`))];
      }
      // 装扮兑换券：自选套装 / 部位 / 属性
      const sets = T.kind === 'sky' ? CASH_SKY_SETS : CASH_ADV_SETS;
      if (!sets.includes(CTK.set)) CTK.set = sets[0];
      const pick = (arr, cur, set) => h('div', { class: 'csy-pick' }, arr.map(([id, nm]) => h('span', { class: id === cur ? 'on' : '', onclick: () => { set(id); sfx.click(); el._render(); } }, nm)));
      const D = ITEMS[avKey(CTK.set, CTK.slot)], O = cashAvOpts(D);
      if (!O.some(o => o[0] === CTK.opt)) CTK.opt = O[0][0];
      const it = makeItem(D.key); it.opt = CTK.opt; normalizeItem(it);
      const s = h('select', {}, O.map(([k, v]) => h('option', { value: k }, statLine(k, v)))); s.value = CTK.opt; s.addEventListener('change', () => { CTK.opt = s.value; el._render(); });
      const tip = itemTip(it, { cmp: false }); tip.style.width = '100%'; tip.style.fontSize = '.8em';
      return [h('div', { class: 'csy' }, h('div', { class: 'col' },
        h('div', { class: 'csy' }, h('div', { class: 'col', style: 'grid-column:1/-1' },
          h('b', { style: 'color:#e8c26a' }, '套装'), pick(sets.map(k => [k, CASH_SETS[k].name]), CTK.set, v => { CTK.set = v; }),
          h('b', { style: 'color:#e8c26a' }, '部位'), pick(AV_PIECE_SLOTS.map(k => [k, SLOT_NAME[k]]), CTK.slot, v => { CTK.slot = v; }),
          h('b', { style: 'color:#e8c26a' }, '属性'), s))), tip),
        h('div', { class: 'row', style: 'gap:.4em' }, h('button', { class: 'btn', onclick: () => {
          const r = cashUseTicket(tk, null, { set: CTK.set, slot: CTK.slot, opt: CTK.opt }); if (r.err) { toastMsg(r.err, '#ff6a6a'); sfx.error(); return; }
          menus.close('ticket'); itemsRefresh(); cashShowGot('兑换成功', r.items);
        } }, '兑换'))];
    }, { w: 34, at: 'center' });
    el.dataset.block = '1';
    return el;
  },
  /* ---- 宠物窗口 ---- */
  w_pet() {
    const el = itemWin('pet', '宠物', el => {
      const pet = inv.equip.av_pet, aura = inv.equip.av_aura;
      const P = pet && ITEMS[pet.key], A = aura && ITEMS[aura.key];
      const pv = h('div', { class: 'pv' }, cashPetPreview(P ? P.pet : null, A ? A.aura : null, 280, 200));
      const slots = h('div', { class: 'slots' });
      for (const s of ['av_pet', 'av_petR', 'av_petB', 'av_petG', 'av_aura']) slots.append(equipSlotEl(s, el), h('span', {}, SLOT_NAME[s], inv.equip[s] ? h('div', { class: `q${inv.equip[s].rar}`, style: 'font-weight:800' }, inv.equip[s].name) : h('div', { class: 'dim' }, '（空）')));
      const tot = {}; for (const s of ['av_pet', 'av_petR', 'av_petB', 'av_petG']) { const it = inv.equip[s]; if (it) for (const k in it.st) tot[k] = (tot[k] || 0) + it.st[k]; }
      return [h('div', { class: 'cpet' }, pv, slots),
        h('div', { class: 'cash-note' }, Object.keys(tot).length ? '宠物与宠物装备合计：' + Object.keys(tot).map(k => statLine(k, tot[k])).join('，') : '还没有宠物。商城“宠物”页可以买宠物和宠物蛋，节日礼包也送宠物。'),
        h('div', { class: 'ihint' }, '把背包“时装”页里的宠物 / 宠物装备 / 光环拖到格子上，或右键直接穿戴。宠物会跟在你身后，城镇和地下城里都会出现。')];
    }, { w: 30, at: 'left' });
    return el;
  },
});
