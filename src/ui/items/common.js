/* =====================================================================
   物品窗口公共部分：样式、物品格子、官方风格 tooltip（含与当前装备对比）、窗口内的确认框 / 数量输入框、刷新
   ===================================================================== */
addStyle(`
:root{--q0:#ffffff;--q1:#68d5ed;--q2:#b36bff;--q3:#ff55ff;--q4:#ff7800;--q5:#ffb400;--qset:#8cff5a}
.q0{color:var(--q0)}.q1{color:var(--q1)}.q2{color:var(--q2)}.q3{color:var(--q3)}.q4{color:var(--q4)}.q5{color:var(--q5)}
.iwin{position:absolute}
.iwin.at-left{left:31%}.iwin.at-right{left:75%}
.iwin .bd{padding:.55em .75em .7em}
.itabs{display:flex;gap:.18em;align-items:flex-end;border-bottom:.1em solid #6a5436;margin-bottom:.45em;flex-wrap:wrap}
.itab{padding:.28em .75em;cursor:pointer;background:linear-gradient(#2c2432,#18121e);border:.1em solid #4a3c2c;border-bottom:none;border-radius:.35em .35em 0 0;color:#b8a888;font-weight:800;font-size:.88em;white-space:nowrap}
.itab:hover{color:#fff2d0}
.itab.on{background:linear-gradient(#6a4e26,#2e2010);color:#ffe8a8;border-color:#b89450;box-shadow:inset 0 .08em 0 rgba(255,230,160,.35)}
.itab .cnt{font-size:.8em;color:#9a8f7c;margin-left:.25em}
.igrid{display:grid;grid-template-columns:repeat(8,3.1em);gap:.16em;padding:.3em;background:#0b090e;border:.1em solid #3a3040;border-radius:.25em;align-content:start;overflow-y:auto;overflow-x:hidden}
.islot{position:relative;width:3.1em;height:3.1em;background:linear-gradient(#1e1a24,#110d15);border:.1em solid #2e2838;border-radius:.2em;cursor:pointer;box-sizing:border-box;touch-action:none}
.islot img{width:100%;height:100%;display:block;border-radius:.12em;pointer-events:none}
.islot:hover{border-color:#e8c26a;z-index:1}
.islot .n{position:absolute;right:.12em;bottom:0;font-size:.68em;font-weight:900;color:#fff;text-shadow:0 0 .2em #000,0 0 .2em #000,0 0 .2em #000;pointer-events:none}
.islot .e{position:absolute;left:.12em;top:0;font-size:.64em;font-weight:900;color:#8fe8ff;text-shadow:0 0 .2em #000,0 0 .2em #000;pointer-events:none}
.islot .e.amp{color:#ff6a9a}
.islot .qk{position:absolute;right:.1em;top:0;font-size:.58em;font-weight:900;color:#ffe070;text-shadow:0 0 .2em #000;pointer-events:none}
.islot .lbl{position:absolute;inset:0;display:grid;place-items:center;font-size:.66em;color:#6a5a4a;font-weight:800;pointer-events:none;text-align:center;line-height:1.1}
.islot.q5{box-shadow:0 0 .45em rgba(255,180,0,.7);animation:iepic 1.6s ease-in-out infinite}
@keyframes iepic{50%{box-shadow:0 0 .8em rgba(255,200,60,.95)}}
.islot.sel{outline:.16em solid #ffe070;outline-offset:-.02em}
.islot.chk{outline:.16em solid #6aff7a;outline-offset:-.02em}
.islot.chk::after{content:'✔';position:absolute;right:.08em;top:-.05em;color:#6aff7a;font-weight:900;font-size:.8em;text-shadow:0 0 .2em #000}
.islot.broken img{filter:grayscale(.8) brightness(.55) sepia(1) hue-rotate(-50deg) saturate(3)}
.islot.broken::before{content:'耐久 0';position:absolute;left:0;right:0;bottom:.1em;text-align:center;font-size:.5em;color:#ff6a6a;font-weight:900;z-index:1;text-shadow:0 0 .2em #000}
.islot.dim img{opacity:.35}
.islot.req::before{content:'';position:absolute;inset:0;background:rgba(200,30,30,.28);border-radius:.12em;pointer-events:none}
.islot.empty{cursor:default}
.ibar{display:flex;gap:.5em;align-items:center;margin-top:.45em;flex-wrap:wrap}
.ibar .sp{flex:1}
.igold{color:#ffd24a;font-weight:900;text-shadow:0 0 .3em rgba(0,0,0,.8)}
.igold::before{content:'';display:inline-block;width:.8em;height:.8em;border-radius:50%;background:radial-gradient(circle at 35% 35%,#fff6c0,#ffd24a 45%,#a06a10);margin-right:.3em;vertical-align:-.05em;box-shadow:0 0 .2em #000}
.btn.sm{padding:.25em .65em;font-size:.85em}
.ihint{font-size:.72em;color:#8a806e;line-height:1.5}
.ilist{display:flex;flex-direction:column;gap:.2em;max-height:24em;overflow:auto;padding-right:.2em}
.ilist::-webkit-scrollbar,.igrid::-webkit-scrollbar{width:.4em}.ilist::-webkit-scrollbar-thumb{background:#5a4a36;border-radius:.2em}
/* tooltip */
#itip{position:absolute;z-index:99999;pointer-events:none}
.itip-pair{display:flex;gap:.4em;align-items:flex-start}
.itip{width:17em;background:linear-gradient(180deg,rgba(18,14,24,.98),rgba(8,6,12,.98));border:.1em solid #5a4a36;border-radius:.3em;padding:.5em .65em;font-size:.86em;line-height:1.45;box-shadow:0 .4em 1.4em rgba(0,0,0,.7);color:#e0d8c4}
.itip.r5{border-color:#a8801a;box-shadow:0 0 1em rgba(255,180,0,.35),0 .4em 1.4em rgba(0,0,0,.7)}
.itip.r4{border-color:#a05a1a}.itip.r3{border-color:#8a3a8a}.itip.r2{border-color:#5a3a8a}
.itip .cur{font-size:.75em;color:#ffe070;font-weight:900;margin-bottom:.2em}
.itip-hd{display:flex;gap:.5em;align-items:center}
.itip-hd img{width:2.9em;height:2.9em;border-radius:.2em;flex:none}
.itip-hd .nm{font-weight:900;font-size:1.12em;line-height:1.2}
.itip-hd .sub{font-size:.82em;color:#9a8f7c}
.itip-hd .gr{margin-left:auto;align-self:flex-start;font-size:.78em;color:#c8b890;white-space:nowrap}
.itip .sec{border-top:.08em solid #3a3040;margin-top:.35em;padding-top:.3em}
.itip .bad{color:#ff5a5a}.itip .good{color:#8aff8a}.itip .dimt{color:#8a806e}
.itip .enh{color:#8fe8ff}.itip .fx{color:#ffb24a}.itip .set{color:var(--qset)}.itip .set .off{color:#5a6a50}
.itip .desc{color:#b8ac90;font-style:italic;font-size:.92em}
.itip .up{color:#6aff8a;font-size:.88em}.itip .down{color:#ff6a6a;font-size:.88em}
.itip .price{color:#ffd24a;font-size:.9em}
.itip .durbar{display:inline-block;width:5em;height:.45em;background:#2a2228;border-radius:.2em;vertical-align:middle;margin-left:.3em;overflow:hidden}
.itip .durbar i{display:block;height:100%;background:linear-gradient(90deg,#6ad06a,#bfe86a)}
.itip .durbar.low i{background:linear-gradient(90deg,#ff4a3a,#ff9a4a)}
/* 装备深化：史诗 / 神器 / 传说的 tooltip */
.itip.r5{animation:itipepic 2.4s ease-in-out infinite;background:linear-gradient(180deg,rgba(40,28,8,.98),rgba(10,7,4,.98) 38%,rgba(8,6,12,.98))}
@keyframes itipepic{50%{box-shadow:0 0 1.6em rgba(255,190,40,.55),0 .4em 1.4em rgba(0,0,0,.7);border-color:#e0b040}}
.itip.r4{background:linear-gradient(180deg,rgba(40,20,6,.98),rgba(8,6,12,.98) 35%)}.itip.r3{background:linear-gradient(180deg,rgba(36,12,36,.98),rgba(8,6,12,.98) 35%)}
.itip-hd .nm.q5{background:linear-gradient(90deg,#ffb400,#fff1b8 40%,#ffb400 60%,#ffcf4a);background-size:220% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:itipname 2.6s linear infinite}
@keyframes itipname{to{background-position:-220% 0}}
.itip-hd .tag{display:inline-block;font-size:.66em;font-weight:900;padding:0 .35em;border-radius:.2em;margin-left:.3em;vertical-align:.12em;color:#1a1004;background:#ffb400}
.itip-hd .tag.r4{background:#ff7800}.itip-hd .tag.r3{background:#ff55ff}.itip-hd .tag.abyss{background:linear-gradient(90deg,#b05aff,#ff5ad0);color:#fff}
.itip .enh.amp,.itip .amp{color:#ff5a8a}.itip .forge{color:#ffb070}.itip .orb{color:#9ae8ff}
.itip .proc{color:#ffe08a;background:rgba(255,180,0,.08);border-left:.16em solid #ffb400;padding:.15em .4em;margin-top:.25em;border-radius:0 .2em .2em 0}
.itip .proc b{color:#ffcf4a}
.itip .bindl{font-size:.85em;color:#ffb070}.itip .bindl.free{color:#8fd88f}
.itip .src{font-size:.82em;color:#9ab8d8}
.itip .scorel{font-size:.82em;color:#c8b890;display:flex;justify-content:space-between}
.itip .scorel b{color:#ffe070}
/* 窗口内对话框 */
.idlg-wrap{position:absolute;inset:0;background:rgba(0,0,0,.55);display:grid;place-items:center;z-index:20;border-radius:.3em}
.idlg{min-width:18em;max-width:26em;background:linear-gradient(180deg,#2a2030,#150f1a);border:.12em solid #a88450;border-radius:.35em;padding:.8em 1em;box-shadow:0 .5em 2em rgba(0,0,0,.8)}
.idlg h4{margin:0 0 .5em;color:#ffe8a8;font-size:1.05em}
.idlg .msg{line-height:1.6;font-size:.92em;max-height:14em;overflow:auto}
.idlg .row{justify-content:flex-end;margin-top:.8em}
.idlg input[type=number]{width:6em;font-size:1.1em;padding:.25em .4em;background:#0c0a10;color:#fff;border:.1em solid #6a5436;border-radius:.2em;font-family:inherit;text-align:right}
.iqty{display:flex;gap:.3em;align-items:center;justify-content:center;margin:.5em 0}
`);
/* ---- 状态（跨窗口共享，重绘时保留） ---- */
const IW = { invTab: 'equip', shopTab: {}, shopCat: {}, shopSel: {}, sellSel: new Set(), disSel: new Set(), stTab: 'char', enhSel: null };
const ITEM_WINS = ['inv', 'status', 'shop', 'sell', 'storage', 'enhance', 'inherit', 'disassemble', 'repair', 'amplify', 'forge', 'enchant', 'codex', 'abyss', 'bulk'];
// 物品变化后刷新所有打开的物品窗口（原地重绘，保留位置与滚动）
function itemsRefresh(except) {
  menus.hideTip();
  for (const n of ITEM_WINS) { if (n === except) continue; const el = menus.wins[n]; if (el && el._render) el._render(); }
}
// 窗口外框：menus.win + 原地重绘能力
function itemWin(name, title, render, opts = {}) {
  const body = h('div', { class: 'col', style: 'gap:.4em' });
  const el = menus.win(title, body, opts); el.classList.add('iwin');
  if (opts.at) el.classList.add('at-' + opts.at);   // 窗口框架没处理 at 时的默认位置（框架设置了内联 left/top 会覆盖它）
  el._render = () => {
    const keep = [...body.querySelectorAll('[data-sk]')].map(x => [x.dataset.sk, x.scrollTop]);
    body.replaceChildren(...[].concat(render(el)).filter(Boolean));
    for (const [k, t] of keep) { const x = body.querySelector(`[data-sk="${k}"]`); if (x) x.scrollTop = t; }
  };
  el._render();
  return el;
}
/* ---- tooltip ---- */
const itemEff = it => { const o = { ...(it.st || {}) }, e = enhStats(it), x = gearExtraStats(it); for (const k in e) o[k] = (o[k] || 0) + e[k]; for (const k in x) o[k] = (o[k] || 0) + x[k]; return o; };
const TIP_ORDER = ['atk', 'matk', 'indep', 'def', 'mdef', 'str', 'int', 'vit', 'spr', 'hp', 'mp', 'crit', 'mcrit', 'critDmg', 'aspd', 'cspd', 'mspd', 'hit', 'evade', 'hardness', 'stagger', 'fire', 'ice', 'light', 'dark', 'elemAll', 'rfire', 'rice', 'rlight', 'rdark', 'resAll', 'allStat'];
function itemTypeName(it) {
  if (it.kind === 'equip') {
    if (it.slot === 'weapon') return (WTYPES[it.wtype] || {}).name || '武器';
    if (ARMOR_SLOTS.includes(it.slot)) return `${(ATYPES[it.atype] || {}).name || ''}${SLOT_NAME[it.slot]}`;
    return SLOT_NAME[it.slot];
  }
  return { use: '消耗品', mat: '材料', quest: '任务道具' }[it.kind] || '';
}
function itemTipOne(it, cur, head, who) {
  const D = ITEMS[it.key] || {}, r = it.rar || 0, R = RARITY[r];
  const W = who || { lvl: game.lvl, cls: game.player && game.player.cls, job: game.job, equip: inv.equip, codex: save.data && save.data.codex };   // 查看别人（ui/social/inspect.js）时按对方的等级 / 职业 / 装备 / 图鉴
  const el = h('div', { class: `itip r${r}` });
  if (head) el.append(h('div', { class: 'cur' }, head));
  const tag = it.kind === 'equip' && r >= 3 ? h('span', { class: `tag r${r}${D.abyss ? ' abyss' : ''}` }, D.abyss ? '深渊' : D.set && r === 5 ? '史诗套装' : R.name) : null;
  const encol = it.dim ? '#ff5a8a' : '#8fe8ff';
  el.append(h('div', { class: 'itip-hd' }, h('img', { src: itemIconSrc(it, 64) }),
    h('div', {}, h('div', { class: `nm q${r}` }, it.enh ? h('span', { style: `color:${encol};-webkit-text-fill-color:${encol}` }, `+${it.enh} `) : null, it.name + (it.n > 1 ? ` ×${it.n}` : '')), h('div', { class: 'sub' }, `${R.name} ${itemTypeName(it)}`, tag)),
    it.kind === 'equip' && it.grade != null ? h('div', { class: 'gr' }, GRADES[it.grade]) : null));
  if (it.kind === 'equip') {
    const s1 = h('div', { class: 'sec' });
    const cap = typeof equipLevelCap === 'function' ? equipLevelCap(W.lvl, game.scene) : W.lvl;
    s1.append(h('div', { class: it.lvl > cap ? 'bad' : '' }, `Lv.${it.lvl} 以上可以使用${cap > W.lvl ? `（契约上限 Lv.${cap}）` : ''}`));
    if (it.slot === 'weapon' && it.cls) s1.append(h('div', { class: W.cls && it.cls !== W.cls ? 'bad' : '' }, `${CLASSES[it.cls] ? CLASSES[it.cls].name : it.cls}专用`));
    if (it.slot === 'weapon' && wtypeJobText(it.wtype)) s1.append(h('div', { class: W.cls && !wtypeJobOk(it.wtype, W.job) ? 'bad' : '' }, `只有${wtypeJobText(it.wtype)}能装备`));
    if (it.atype && ARMOR_SLOTS.includes(it.slot)) { const m = W.cls && masteryOf(W.cls, W.job) === it.atype; s1.append(h('div', {}, `${ATYPES[it.atype].name}`, h('span', { class: m ? 'good' : it.atype === 'heavy' || it.atype === 'plate' ? 'bad' : 'dimt' }, m ? '（精通：有额外加成）' : it.atype === 'heavy' || it.atype === 'plate' ? '（非精通：攻速 / 施放 / MP 恢复略微降低）' : '（非精通）'))); }
    if (it.slot === 'weapon' && WTYPES[it.wtype]) { const T = WTYPES[it.wtype]; s1.append(h('div', {}, `攻击速度：${T.spd}`, T.aspd ? h('span', { class: T.aspd > 0 ? 'good' : 'bad' }, `（${T.aspd > 0 ? '+' : ''}${Math.round(T.aspd * 100)}%）`) : null, T.elem ? h('span', { class: 'enh' }, `　附带${{ fire: '火', ice: '冰', light: '光', dark: '暗' }[T.elem]}属性攻击`) : null)); }
    if (it.durMax) { const low = it.dur <= it.durMax * 0.2; s1.append(h('div', { class: it.dur <= 0 ? 'bad' : '' }, `耐久度 ${it.dur}/${it.durMax}`, h('span', { class: 'durbar' + (low ? ' low' : '') }, h('i', { style: `width:${Math.round(it.dur / it.durMax * 100)}%` })), it.dur <= 0 ? '　属性失效，请修理' : null)); }
    s1.append(h('div', { class: 'bindl' + (itemBind(it) ? '' : ' free') }, itemBindText(it)));
    el.append(s1);
    // 属性（含强化）与对比
    const eff = itemEff(it), ce = cur && cur !== it ? itemEff(cur) : null, keys = TIP_ORDER.filter(k => eff[k] || (ce && ce[k]));
    if (keys.length) {
      const s2 = h('div', { class: 'sec' });
      for (const k of keys) {
        const v = eff[k] || 0; let cmp = null;
        if (ce) { const d = v - (ce[k] || 0); if (Math.abs(d) > 1e-6) { const pct = (STAT_INFO[k] || [])[1]; cmp = h('span', { class: d > 0 ? 'up' : 'down' }, ` ${d > 0 ? '▲' : '▼'}${pct ? (Math.abs(d) * 100).toFixed(1) + '%' : fmtNum(Math.abs(d))}`); } }
        s2.append(h('div', { class: v ? '' : 'dimt' }, statLine(k, v), cmp));
      }
      el.append(s2);
    }
    if (it.enh) { const e = enhStats(it), av = it.dim ? ampStatVal(it) : 0; el.append(h('div', { class: 'sec enh' + (it.dim ? ' amp' : '') }, `${it.dim ? '增幅' : '强化'} +${it.enh}：`, Object.keys(e).map(k => it.dim && k === it.dim ? `${DIM_NAME[k]} +${av}${e[k] - av ? '，' + statLine(k, e[k] - av) : ''}` : statLine(k, e[k])).join('，'))); }
    else if (it.dim) el.append(h('div', { class: 'sec amp' }, `异次元属性：${DIM_NAME[it.dim]}（增幅后生效）`));
    if (it.forge) { const f = forgeStats(it); el.append(h('div', { class: 'sec forge' }, `锻造 +${it.forge}：`, Object.keys(f).map(k => statLine(k, f[k])).join('，'))); }
    if (it.orb) { const o = orbStats(it); el.append(h('div', { class: 'sec orb' }, `附魔【${orbName(it)}】：`, Object.keys(o).map(k => statLine(k, o[k])).join('，'))); }
    if (it.fx && Object.keys(it.fx).some(k => typeof it.fx[k] === 'number')) {
      const s3 = h('div', { class: 'sec fx' });
      const shown = new Set();
      for (const k in it.fx) { if (typeof it.fx[k] !== 'number' || shown.has(k)) continue; if (k === 'mcrit' && it.fx.crit === it.fx.mcrit) continue; if (k === 'cspd' && it.fx.aspd === it.fx.cspd) { continue; } shown.add(k); s3.append(h('div', {}, '◆ ', k === 'crit' && it.fx.mcrit === it.fx.crit ? `暴击率 ${fmtStatVal('crit', it.fx.crit)}` : k === 'aspd' && it.fx.cspd === it.fx.aspd ? `攻击 / 施放速度 ${fmtStatVal('aspd', it.fx.aspd)}` : statLine(k, it.fx[k]))); }
      if (it.fx.atkElem) s3.append(h('div', {}, `◆ 攻击附带${{ fire: '火', ice: '冰', light: '光', dark: '暗' }[it.fx.atkElem]}属性`));
      el.append(s3);
    }
    if (D.proc) for (const P of [].concat(D.proc)) if (P && P.desc) el.append(h('div', { class: 'proc' }, h('b', {}, `${r >= 5 ? '专属特效' : '特效'}${P.name ? '【' + P.name.replace(/！$/, '') + '】' : ''}：`), P.desc));
    if (it.set && SETS[it.set]) {
      const S = SETS[it.set], own = new Set(SLOTS.map(s => W.equip[s]).filter(x => x && x.set === it.set && itemActive(x)).map(x => x.key));
      const s4 = h('div', { class: 'sec set' }, h('div', { style: 'font-weight:900' }, `${S.name}（${own.size}/${S.pieces.length}）`));
      for (const k of S.pieces) s4.append(h('div', { class: own.has(k) ? '' : 'off', style: 'padding-left:.6em;font-size:.9em' }, (ITEMS[k] || {}).name || k));
      for (const n in S.bonus) { const B = S.bonus[n], P = B.proc && [].concat(B.proc).find(x => x && x.desc); s4.append(h('div', { class: own.size >= +n ? '' : 'off' }, `[${n} 件套] ${B.desc || Object.keys(B.st || {}).map(k => statLine(k, B.st[k])).join('，')}${P && !(B.desc || '').includes(P.desc) ? '；' + P.desc : ''}`)); }
      el.append(s4);
    }
  } else {
    const s = h('div', { class: 'sec' });
    const U = D.use;
    if (U && (U.hp || U.mp) && !D.desc) s.append(h('div', {}, `${U.hp ? `恢复 ${U.hp * 100}% HP ` : ''}${U.mp ? `恢复 ${U.mp * 100}% MP` : ''}`));
    if (D.desc) s.append(h('div', {}, D.desc));
    if (it.kind === 'use' && U) s.append(h('div', { class: 'dimt', style: 'font-size:.85em' }, U.open ? '右键打开' : U.dungeonOnly ? '右键使用（地下城内）· 可以拖到快捷栏' : '右键使用 · 可以拖到快捷栏'));
    if (it.kind === 'quest') s.append(h('div', { class: 'dimt', style: 'font-size:.85em' }, '任务道具：不能出售、丢弃'));
    if (s.childNodes.length) el.append(s);
  }
  if (it.kind === 'equip' && it.desc) el.append(h('div', { class: 'sec desc' }, it.desc));
  if (D.orb) el.append(h('div', { class: 'sec orb' }, `可附魔：${orbOnText(D.orb.on)}`, h('br'), Object.keys(D.orb.st).map(k => statLine(k, D.orb.st[k])).join('，'), h('div', { class: 'dimt', style: 'font-size:.85em' }, '右键打开附魔窗口')));
  const srcTxt = itemSourceText(it.key); if (srcTxt) el.append(h('div', { class: 'sec src' }, '获取途径：' + srcTxt));
  const coded = !!(W.codex && W.codex[it.key]);
  if (it.kind === 'equip' && !isAvatar(it)) el.append(h('div', { class: 'sec scorel' }, h('span', {}, '装备评分 ', h('b', {}, fmtNum(itemScore(it)))), codexWorthy(it) ? h('span', { class: coded ? 'good' : 'dimt' }, coded ? '图鉴已登记' : '图鉴未登记') : null));
  const sp = sellPrice(it);
  el.append(h('div', { class: 'sec price' }, canSell(it) ? `出售价格 ${fmtNum(sp)} G` : '不能出售'));
  return el;
}
// 官方风格 tooltip：背包里的装备会并排显示“当前装备”方便对比
function itemTip(it, opt = {}) {
  const cur = it.kind === 'equip' && opt.cmp !== false ? inv.equip[it.slot] : null;
  const main = itemTipOne(it, cur, null, opt.who);
  const sum = it.kind === 'equip' && opt.cmp !== false && typeof equipCompareTip === 'function' ? equipCompareTip(it) : null;   // 换上后综合 ▲x%（输出 / 生存）
  if (sum) main.insertBefore(sum, main.firstChild);
  if (!cur || cur === it) return main;
  return h('div', { class: 'itip-pair' }, main, itemTipOne(cur, null, '▶ 装备中'));
}
// 物品 tooltip 用自己的浮层 #itip（不借用窗口框架的 #tip，避免样式互相影响）；menus.hideTip() 时一起收起
let itipEl = null;
function showItemTip(it, ev, opt) {
  if (!it) return;
  if (menus.tip) menus.tip.classList.add('hidden');
  if (!itipEl || !itipEl.isConnected) { itipEl = h('div', { id: 'itip' }); dom.appendChild(itipEl); }
  const sig = `${it.id}|${it.enh}|${it.dur}|${it.n}|${opt && opt.cmp}|${(inv.equip[it.slot] || {}).id}`;
  if (itipEl._sig !== sig || itipEl.hidden) { itipEl.replaceChildren(itemTip(it, opt)); itipEl._sig = sig; }   // 同一件物品只移动位置，不重建
  itipEl.hidden = false;
  const r = stage.getBoundingClientRect(), x = ev.clientX - r.left + 18, y = ev.clientY - r.top + 14;
  const tw = itipEl.offsetWidth, th = itipEl.offsetHeight;
  itipEl.style.left = Math.max(4, x + tw > r.width - 6 ? ev.clientX - r.left - tw - 14 : x) + 'px';
  itipEl.style.top = Math.max(4, Math.min(y, r.height - th - 6)) + 'px';
}
function hideItemTip() { if (itipEl) { itipEl.hidden = true; itipEl._sig = null; } }
// 记录指针位置：拖放落在窗口上（但不是格子）时不算“拖到窗外丢弃”
const lastPtr = { x: 0, y: 0 };
addEventListener('pointermove', e => { lastPtr.x = e.clientX; lastPtr.y = e.clientY; }, true);
const ptrOverWindow = () => { const el = document.elementFromPoint(lastPtr.x, lastPtr.y); return !!(el && el.closest('.win')); };
{ const hide0 = menus.hideTip; menus.hideTip = function () { hideItemTip(); return hide0.apply(this, arguments); }; }
// 旧接口：返回 HTML 字符串
menus.itemTip = it => itemTip(it).outerHTML;
/* ---- 物品格子 ---- */
// opt：{ onClick(ev), onRight(ev), onDbl(ev), drag: () => payload, drop: { accept, drop }, sel, chk, label, cmp, dim, quick, who（查看别人：{ lvl, cls, job, equip, codex }） }
function itemSlot(it, opt = {}) {
  const cls = ['islot'];
  if (!it) cls.push('empty');
  else {
    cls.push('q' + (it.rar || 0));
    if (it.kind === 'equip' && it.durMax && it.dur <= 0) cls.push('broken');
    if (it.kind === 'equip' && it.lvl > (opt.who ? opt.who.lvl : game.lvl)) cls.push('req');
  }
  if (opt.sel) cls.push('sel'); if (opt.chk) cls.push('chk'); if (opt.dim) cls.push('dim');
  const el = h('div', { class: cls.join(' ') });
  if (it) {
    el.append(h('img', { src: itemIconSrc(it, 64), draggable: 'false' }));
    if (it.n > 1) el.append(h('span', { class: 'n' }, it.n > 9999 ? '9999+' : String(it.n)));
    if (it.enh) el.append(h('span', { class: 'e' + (it.dim ? ' amp' : '') }, '+' + it.enh));   // 增幅（红字）显示成红色
    if (opt.quick && it.kind === 'use') { const qi = inv.quick.indexOf(it.key); if (qi >= 0) el.append(h('span', { class: 'qk' }, String(qi + 1))); }
    if (it.kind === 'equip' && typeof setSlotDecor === 'function') setSlotDecor(el, it, opt.worn, opt.who && opt.who.equip);   // 套装：绿框 + 件数角标
    if ((opt.quick || opt.cmp === true) && it.kind === 'equip' && typeof equipCompareBadge === 'function') { const b = equipCompareBadge(it); if (b) { el.append(b); if (b.classList.contains('up')) el.classList.add('better'); } }   // ▲▼ 比身上的好 / 差
    el.addEventListener('mousemove', ev => { if (!dnd.cur) showItemTip(it, ev, { cmp: opt.cmp, who: opt.who }); });
    el.addEventListener('mouseleave', () => hideItemTip());
    let lp = null;   // 触屏长按看说明
    el.addEventListener('touchstart', ev => { const t = ev.touches[0]; lp = setTimeout(() => showItemTip(it, t, { cmp: opt.cmp, who: opt.who }), 450); }, { passive: true });
    el.addEventListener('touchend', () => { clearTimeout(lp); setTimeout(() => hideItemTip(), 1500); });
  } else if (opt.label) el.append(h('span', { class: 'lbl' }, opt.label));
  if (opt.onClick) el.addEventListener('click', ev => { if (el._dndJustDropped) return; opt.onClick(ev); });
  if (opt.onRight) el.addEventListener('contextmenu', ev => { ev.preventDefault(); menus.hideTip(); opt.onRight(ev); });
  if (opt.onDbl) el.addEventListener('dblclick', ev => { menus.hideTip(); opt.onDbl(ev); });
  if (it && opt.drag) dnd.source(el, opt.drag);
  if (opt.drop) dnd.target(el, opt.drop);
  return el;
}
// 复选框（h() 用 setAttribute，checked / disabled 传 null 也会生效，所以单独做）
function itemCheckBox(on, onChange, disabled) { const i = h('input', { type: 'checkbox' }); i.checked = !!on; i.disabled = !!disabled; i.addEventListener('change', () => onChange(i.checked)); return i; }
/* ---- 窗口内对话框（确认 / 数量） ---- */
let idlgOpen = null;
function itemDialog(win, { title = '确认', msg, body, okText = '确定', cancelText = '取消', onOk, danger }) {
  if (!win) return;
  closeItemDialog();
  const wrap = h('div', { class: 'idlg-wrap' });
  const close = () => { wrap.remove(); if (idlgOpen === wrap) idlgOpen = null; };
  const ok = () => { if (onOk && onOk() === false) return; close(); };
  wrap._ok = ok; wrap._close = close;
  wrap.append(h('div', { class: 'idlg' }, h('h4', {}, title), msg ? h('div', { class: 'msg', html: msg }) : null, body || null,
    h('div', { class: 'row' }, h('button', { class: 'btn sm blue', onclick: () => { sfx.click(); close(); } }, cancelText), h('button', { class: 'btn sm' + (danger ? ' red' : ''), onclick: () => { sfx.click(); ok(); } }, okText))));
  wrap.addEventListener('pointerdown', ev => { if (ev.target === wrap) close(); });
  win.append(wrap); idlgOpen = wrap;
  const inp = wrap.querySelector('input'); if (inp) setTimeout(() => { inp.focus(); inp.select(); }, 30);
  return wrap;
}
function closeItemDialog() { if (idlgOpen) { idlgOpen.remove(); idlgOpen = null; } }
// 数量输入：Shift + 点击时弹出
function qtyDialog(win, { title, max, init = 1, unit = 0, onOk }) {
  max = Math.max(1, max | 0);
  const inp = h('input', { type: 'number', min: 1, max, value: Math.min(init, max) });
  const tot = h('div', { class: 'small gold', style: 'text-align:center;min-height:1.2em' });
  const upd = () => { const v = clamp(+inp.value | 0, 1, max); tot.textContent = unit ? `合计 ${fmtNum(v * unit)} G` : ''; };
  inp.addEventListener('input', upd); inp.addEventListener('keydown', ev => { ev.stopPropagation(); if (ev.key === 'Enter') { ev.preventDefault(); idlgOpen && idlgOpen._ok(); } else if (ev.key === 'Escape') { ev.preventDefault(); closeItemDialog(); } });
  const step = d => h('button', { class: 'btn sm', onclick: () => { inp.value = clamp((+inp.value | 0) + d, 1, max); upd(); } }, (d > 0 ? '+' : '') + d);
  const body = h('div', {}, h('div', { class: 'iqty' }, step(-10), step(-1), inp, step(1), step(10), h('button', { class: 'btn sm', onclick: () => { inp.value = max; upd(); } }, '最大')), tot);
  upd();
  return itemDialog(win, { title, body, onOk: () => onOk(clamp(+inp.value | 0, 1, max)) });
}
// 对话框打开时：Esc 只关对话框，Enter 确认（捕获阶段拦截，不让游戏 / 窗口框架收到）
addEventListener('keydown', ev => {
  if (!idlgOpen || !idlgOpen.isConnected) { idlgOpen = null; return; }
  if (ev.key === 'Escape') { ev.stopImmediatePropagation(); ev.preventDefault(); closeItemDialog(); }
  else if (ev.key === 'Enter') { ev.stopImmediatePropagation(); ev.preventDefault(); idlgOpen._ok(); }
  else if (ev.target.tagName !== 'INPUT') ev.stopImmediatePropagation();
}, true);
// 贵重物品判断（买卖前二次确认）
const isValuable = (it, gold = 0) => (it.rar || 0) >= 3 || (it.enh || 0) > 0 || !!it.set || gold >= 10000;
const itemNameHtml = it => `<span class="q${it.rar || 0}">${it.enh ? '+' + it.enh + ' ' : ''}${it.name}${it.n > 1 ? ' ×' + it.n : ''}</span>`;
function tabCounts(list) { const o = {}; for (const x of list) { const t = TAB_OF(x); o[t] = (o[t] || 0) + 1; } return o; }
// 升级后商店库存（按等级段）和“需要等级”标记要刷新
bus.on('levelUp', () => { if (ITEM_WINS.some(n => menus.isOpen(n))) itemsRefresh(); });
