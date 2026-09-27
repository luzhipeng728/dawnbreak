/* =====================================================================
   装备图鉴（参照官方收集箱）：史诗武器 / 史诗防具 / 史诗首饰·特殊 / 史诗套装 / 神器·稀有套装 / 传说·异界套装 + 收集加成 + 获得记录
   打开：个人信息（M）窗口的「装备图鉴」按钮、物品栏的「图鉴」按钮、赛丽亚的「装备图鉴」
   ===================================================================== */
addStyle(`
.codexwin .csum{display:flex;gap:.8em;flex-wrap:wrap;align-items:center;font-size:.86em;background:#0c0a10;border:.08em solid #3a3040;border-radius:.25em;padding:.35em .6em}
.codexwin .csum b{color:#ffe070}
.codexwin .cbar{flex:1;min-width:8em;height:.55em;background:#1a1420;border-radius:.3em;overflow:hidden;border:.08em solid #3a3040}
.codexwin .cbar i{display:block;height:100%;background:linear-gradient(90deg,#ffb400,#fff1b8)}
.codexwin .igrid{grid-template-columns:repeat(10,3.1em);max-height:17em;overflow:auto}
.codexwin .islot.miss img{filter:grayscale(1) brightness(.35)}
.codexwin .islot.miss::after{content:'?';position:absolute;inset:0;display:grid;place-items:center;color:#8a806e;font-weight:900;font-size:1.1em;pointer-events:none}
.codexwin .cdet{display:flex;gap:.6em;align-items:center;font-size:.84em;background:#0c0a10;border:.08em solid #3a3040;border-radius:.25em;padding:.35em .6em;min-height:2.6em}
.codexwin .cdet .src{color:#9ab8d8}
.codexwin .cbonus{display:flex;flex-direction:column;gap:.2em;max-height:19em;overflow:auto;font-size:.86em}
.codexwin .cbonus div{display:flex;gap:.6em;padding:.2em .5em;border-radius:.2em;background:#15111a;border:.08em solid #2e2838;color:#6a6070}
.codexwin .cbonus div.on{color:#e8f8c8;border-color:#5a7a3a;background:#18221a}
.codexwin .cbonus div .need{width:8.5em;color:#c8b890}
.codexwin .clog{display:flex;flex-direction:column;gap:.15em;max-height:19em;overflow:auto;font-size:.84em}
.codexwin .clog div{display:grid;grid-template-columns:2em 1fr 9em 6.5em;gap:.5em;align-items:center;padding:.15em .4em;background:#15111a;border-radius:.2em}
.codexwin .clog img{width:1.8em;height:1.8em}
`);
const codexPreview = {};
const codexItemOf = key => codexPreview[key] || (codexPreview[key] = makeItem(key, 1, { grade: 4 }));
const fmtDate = t => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
Object.assign(menus, {
  w_codex() {
    inv.ensure(); codexData();
    const el = itemWin('codex', '装备图鉴', el => {
      const C = save.data.codex || {}, S = codexStats(), tab = IW.codexTab || 'weapon';
      const pct = S.epicTotal ? S.epic / S.epicTotal : 0;
      const sum = h('div', { class: 'csum' }, h('span', {}, '史诗 ', h('b', {}, `${S.epic}/${S.epicTotal}`)), h('div', { class: 'cbar' }, h('i', { style: `width:${(pct * 100).toFixed(1)}%` })),
        h('span', {}, '集齐套装 ', h('b', {}, `${S.set}/${S.setTotal}`)), h('span', {}, '异界 ', h('b', {}, `${S.legend}/${S.legendTotal}`)), h('span', {}, '深渊史诗 ', h('b', {}, S.abyssEpic)));
      const tabs = h('div', { class: 'itabs' }, [...CODEX_PAGES.map(P => [P.id, P.name, codexKeys(P.id)]), ['bonus', '收集加成'], ['log', '获得记录']].map(([id, nm, keys]) =>
        h('div', { class: 'itab' + (tab === id ? ' on' : ''), onclick: () => { IW.codexTab = id; IW.codexSel = null; sfx.click(); el._render(); } }, nm, keys ? h('span', { class: 'cnt' }, `${keys.filter(k => C[k]).length}/${keys.length}`) : null)));
      if (tab === 'bonus') {
        const L = h('div', { class: 'cbonus', 'data-sk': 'cb' }, CODEX_BONUS.map(B => { const on = codexBonusOn(B, S), k = Object.keys(B.need)[0], nm = { epic: '史诗', set: '集齐套装', legend: '异界 / 传说' }[k];
          return h('div', { class: on ? 'on' : '' }, h('span', { class: 'need' }, `${nm} ${Math.min(S[k] || 0, B.need[k])}/${B.need[k]}`), h('span', {}, B.desc), h('span', { style: 'margin-left:auto' }, on ? '✔ 生效中' : '')); }));
        const tot = codexBonusStats();
        return [sum, tabs, L, h('div', { class: 'cdet' }, h('b', { style: 'color:#8aff8a' }, '当前加成：'), Object.keys(tot).map(k => statLine(k, tot[k])).join('，') || '还没有（登记第一件史诗就能解锁）'),
          h('div', { class: 'ihint' }, '获得史诗、套装部件、异界套装时自动登记进图鉴（卖掉、分解也不会消失）。收集加成对本角色永久生效，决斗场里也生效。')];
      }
      if (tab === 'log') {
        const log = save.data.codexLog || [];
        const L = h('div', { class: 'clog', 'data-sk': 'cl' }, log.length ? log.map(e => { const D = ITEMS[e.key]; if (!D) return null; const it = codexItemOf(e.key);
          const row = h('div', {}, h('img', { src: itemIconSrc(it, 32) }), h('span', { class: `q${D.rar}`, style: 'font-weight:800' }, D.name), h('span', { class: 'dim small' }, e.src), h('span', { class: 'dim small' }, fmtDate(e.t)));
          row.addEventListener('mousemove', ev => showItemTip(it, ev, { cmp: false })); row.addEventListener('mouseleave', hideItemTip); return row; }) : h('div', { class: 'dim', style: 'padding:1em;text-align:center' }, '还没有获得记录'));
        return [sum, tabs, L, h('div', { class: 'ihint' }, '最近 60 条获得记录（新的在上）。')];
      }
      const keys = codexKeys(tab), grid = h('div', { class: 'igrid', 'data-sk': 'cg' });
      for (const k of keys) {
        const it = codexItemOf(k), got = !!C[k];
        const sl = itemSlot(it, { cmp: false, sel: IW.codexSel === k, onClick: () => { IW.codexSel = k; sfx.click(); el._render(); } });
        if (!got) sl.classList.add('miss');
        grid.append(sl);
      }
      const k = IW.codexSel && keys.includes(IW.codexSel) ? IW.codexSel : null, D = k && ITEMS[k], e = k && C[k];
      const det = h('div', { class: 'cdet' }, D ? [h('img', { src: itemIconSrc(codexItemOf(k), 40), style: 'width:2.4em;height:2.4em' }),
        h('div', {}, h('div', { class: `q${D.rar}`, style: 'font-weight:900' }, `${D.name}  Lv.${D.lvl}`), e ? h('div', {}, `获得于 ${fmtDate(e.t)}（Lv.${e.lv}）· `, h('span', { class: 'src' }, e.src), e.n > 1 ? ` · 共获得 ${e.n} 次` : '') : h('div', { class: 'dim' }, '未获得 · 获取途径：', h('span', { class: 'src' }, itemSourceText(k) || '—')))]
        : h('span', { class: 'dim' }, '点击图标查看获得记录；把鼠标放在图标上看属性。'));
      return [sum, tabs, grid, det];
    }, { w: 38 });
    return el;
  },
});
Object.assign(NPC_SERVICES, { codex: { label: '装备图鉴', run: () => menus.open('codex') } });
