/* =====================================================================
   22. 界面窗口（DOM）：标题 / 职业选择 / 地下城选择 / 结算翻牌 / 角色与背包 / 技能 / 商店 / 行商 / 强化 / 系统菜单 / 操作说明
   ===================================================================== */
function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const k in attrs) { if (k === 'class') e.className = attrs[k]; else if (k === 'html') e.innerHTML = attrs[k]; else if (k.startsWith('on')) e.addEventListener(k.slice(2), attrs[k]); else if (k === 'style') e.style.cssText = attrs[k]; else e.setAttribute(k, attrs[k]); }
  for (const c of kids.flat()) if (c != null) e.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  return e;
}
const statTxt = { atk: '攻击力', def: '防御力', hp: 'HP', mp: 'MP', str: '力量', crit: '暴击率', critDmg: '暴击伤害', spd: '速度' };
const fmtStat = (k, v) => (k === 'crit' || k === 'critDmg' || k === 'spd') ? `+${(v * 100).toFixed(1)}%` : `+${fmtNum(v)}`;
const shopStock = {};
const menus = {
  stack: [], wins: {}, tip: null, sel: null,
  modal() { return this.stack.length > 0 || game.scene === 'title'; },
  isOpen(n) { return this.stack.includes(n); },
  open(name, arg) {
    if (this.isOpen(name)) { this.close(name); return; }
    const el = this['w_' + name](arg); if (!el) return;
    el.dataset.win = name; dom.appendChild(el); this.wins[name] = el; this.stack.push(name);
    if (game.scene === 'dungeon') game.paused = true;
    input.clearAll();
  },
  close(name) {
    const el = this.wins[name]; if (el) el.remove(); delete this.wins[name];
    this.stack = this.stack.filter(n => n !== name); this.hideTip();
    if (!this.stack.length && game.scene === 'dungeon' && !(game.dungeon && game.dungeon.state === 'result')) game.paused = false;
    input.clearAll();
  },
  closeTop() { const n = this.stack[this.stack.length - 1]; if (n && n !== 'result') this.close(n); else if (!n) this.open('system'); },
  refresh(name, arg) { if (!this.isOpen(name)) return; this.hideTip(); const old = this.wins[name]; const el = this['w_' + name](arg ?? old._arg); el.dataset.win = name; old.replaceWith(el); this.wins[name] = el; },
  drawUI() { },
  win(title, body, { w, onClose, id } = {}) {
    const el = h('div', { class: 'win', style: w ? `width:${w}em` : '' }, h('div', { class: 'hd' }, h('span', {}, title), h('span', { class: 'x', onclick: () => { if (onClose) onClose(); else this.close(el.dataset.win); sfx.click(); } }, '✕')), h('div', { class: 'bd' }, body));
    return el;
  },
  showTip(html, ev) {
    if (!this.tip) { this.tip = h('div', { id: 'tip' }); dom.appendChild(this.tip); }
    this.tip.innerHTML = html; this.tip.classList.remove('hidden');
    const r = stage.getBoundingClientRect(), x = ev.clientX - r.left + 16, y = ev.clientY - r.top + 12;
    const tw = this.tip.offsetWidth, th = this.tip.offsetHeight;
    this.tip.style.left = Math.min(x, r.width - tw - 8) + 'px'; this.tip.style.top = Math.min(y, r.height - th - 8) + 'px';
  },
  hideTip() { if (this.tip) this.tip.classList.add('hidden'); },
  itemTip(it) {
    const R = RARITY[it.rar || 0];
    if (it.kind !== 'equip') { const C = CONSUMABLES[it.key] || {}; return `<div class="nm r${it.rar || 0}">${it.name}</div><div class="dim small">${C.kind === 'use' ? '消耗品' : '材料'}</div><hr>${C.hp ? `恢复 ${C.hp * 100}% HP<br>` : ''}${C.mp ? `恢复 ${C.mp * 100}% MP<br>` : ''}${it.key === 'crystal' ? '强化装备所需的材料' : ''}${it.key === 'guard' ? '强化失败时装备不会破碎' : ''}${it.key === 'coin' ? '倒下时可原地复活' : ''}<hr><span class="gold">出售价格 ${fmtNum(Math.round((it.price || 10) * 0.2))} G</span>`; }
    const cur = inv.equip[it.slot];
    let s = `<div class="nm r${it.rar}">${it.enh ? '+' + it.enh + ' ' : ''}${it.name}</div><div class="dim small">${R.name} · ${GRADES[it.grade]} · ${SLOT_NAME[it.slot]} · 需要等级 ${it.lvl}</div><hr>`;
    for (const k in it.st) {
      let v = it.st[k];
      if (k === 'atk' && it.slot === 'weapon' && it.enh) v += Math.round(v * enhBonus(it.enh));
      let cmp = '';
      if (cur && cur !== it) { let cv = cur.st[k] || 0; if (k === 'atk' && cur.slot === 'weapon' && cur.enh) cv += Math.round(cv * enhBonus(cur.enh)); const d = v - cv; if (Math.abs(d) > 1e-6) cmp = ` <span class="${d > 0 ? 'up' : 'down'}">(${d > 0 ? '▲' : '▼'}${k === 'crit' ? (Math.abs(d) * 100).toFixed(1) + '%' : fmtNum(Math.abs(d))})</span>`; }
      s += `${statTxt[k] || k} ${fmtStat(k, v)}${cmp}<br>`;
    }
    if (it.enh) s += `<span style="color:#9fe0ff">强化 +${it.enh}：${it.slot === 'weapon' ? '攻击力' : it.st.def ? '防御力' : '力量'}提升</span><br>`;
    if (it.desc) s += `<hr><span class="r5">${it.desc}</span><br>`;
    if (cur && cur !== it) s += `<hr><span class="dim small">当前装备：<span class="r${cur.rar}">${cur.enh ? '+' + cur.enh + ' ' : ''}${cur.name}</span></span><br>`;
    s += `<hr><span class="gold">出售价格 ${fmtNum(Math.round(it.price * 0.2))} G</span>`;
    return s;
  },
  slotEl(it, { onclick, ondbl, extra = '', sel } = {}) {
    const el = h('div', { class: `slot b${it ? it.rar || 0 : 0}${sel ? ' sel' : ''}` });
    if (it) {
      el.appendChild(h('img', { src: itemIconURL(it) }));
      if (it.n > 1) el.appendChild(h('span', { class: 'n' }, String(it.n)));
      if (it.enh) el.appendChild(h('span', { class: 'e' }, '+' + it.enh));
      el.addEventListener('mousemove', ev => this.showTip(this.itemTip(it), ev));
      el.addEventListener('mouseleave', () => this.hideTip());
    }
    if (extra) el.appendChild(h('span', { class: 'lbl' }, extra));
    if (onclick) el.addEventListener('click', () => { sfx.click(); onclick(); });
    if (ondbl) el.addEventListener('dblclick', () => ondbl());
    return el;
  },

  /* ---------------- 标题 ---------------- */
  w_title() {
    const has = save.load();
    const el = h('div', { id: 'title' },
      h('div', { class: 'logo' }, '破晓地下城'), h('div', { class: 'sub' }, 'DAWNBREAK DUNGEON'),
      h('div', { class: 'row', style: 'margin-top:1.5em' },
        has ? h('button', { class: 'btn big', onclick: () => { sfx.click(); this.close('title'); save.apply(); startGame(save.data.cls); } }, `继续冒险 · Lv.${save.data.lvl} ${CLASSES[save.data.cls] ? CLASSES[save.data.cls].name : ''}`) : null,
        h('button', { class: 'btn big' + (has ? ' blue' : ''), onclick: () => { sfx.click(); this.close('title'); this.open('newgame'); } }, has ? '新的冒险' : '开始冒险')),
      h('div', { class: 'small dim', style: 'margin-top:2em;text-align:center;line-height:1.8' }, '方向键移动（双击跑） · X 攻击 · C 跳跃 · Z 指令技能 · ASDFGH / QWERTY 技能栏', h('br'), '全部美术与音乐均为代码实时生成 · 进度自动保存在本机浏览器'));
    return el;
  },
  w_newgame() {
    const cards = Object.entries(CLASSES).map(([id, C]) => {
      const cv = h('canvas', { width: 90, height: 130 });
      const start = () => { this.close('newgame'); save.newGame(id); startGame(id); };
      const card = h('div', { class: 'clscard' + (C.ready === false ? ' off' : ''), onclick: () => {
        sfx.click();
        if (!save.data) { start(); return; }
        // 已有存档：先确认，避免一次点击就覆盖掉全部进度
        confirmBox.replaceChildren(h('div', { style: 'color:#ffb0a0;font-weight:800' }, `开始新冒险会覆盖当前存档（Lv.${save.data.lvl} ${CLASSES[save.data.cls] ? CLASSES[save.data.cls].name : ''}），且无法恢复。`),
          h('div', { class: 'row', style: 'justify-content:center;margin-top:.6em' }, h('button', { class: 'btn red', onclick: start }, `确定，以${C.name}重新开始`), h('button', { class: 'btn', onclick: () => confirmBox.replaceChildren() }, '取消')));
      } },
        cv, h('h3', {}, C.name), h('p', {}, C.desc), C.ready === false ? h('p', { class: 'gold' }, '即将开放') : null);
      if (IMG[`class/${id}`]) cv.replaceWith(Object.assign(new Image(), { src: IMG[`class/${id}`].src, className: 'clsart' }));   // 手绘立绘
      else requestAnimationFrame(() => { const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; x.translate(45, 124); C.model().draw(x, (CLIPS[id] || CLIPS.sword).idle.keys[0][1], 0, {}); });
      return card;
    });
    const confirmBox = h('div', { style: 'text-align:center;min-height:3.6em' });
    return h('div', { id: 'title' }, h('div', { class: 'logo', style: 'font-size:3.4em' }, '选择你的职业'), h('div', { class: 'clsgrid' }, cards), confirmBox,
      h('button', { class: 'btn', onclick: () => { this.close('newgame'); this.open('title'); } }, '返回'));
  },

  /* ---------------- 地下城选择 ---------------- */
  w_dungeon(arg = {}) {
    // 从区域地图的门口进入：只显示这一个地下城（官方做法）；arg.dungeon 缺省时显示当前场景的全部门
    const S = SCENES[arg.scene || (world && world.S.id)] || {}, ids = arg.dungeon ? [arg.dungeon] : (S.gates || []).filter(gateVisible).map(g => g.dungeon);
    let sel = DUNGEONS[ids.includes(this.dgSel) ? this.dgSel : ids[0]];
    if (!sel) return null;
    let diff = Math.min(this.dgDiff ?? 0, save.data.unlocked[sel.id] || 0);
    const body = h('div', { class: 'row', style: 'align-items:stretch;gap:1em' });
    const detail = h('div', { class: 'col', style: 'width:26em' });
    const render = () => {
      this.dgSel = sel.id; this.dgDiff = diff;
      if (listEl) listEl.querySelectorAll('.dgi').forEach(e => e.classList.toggle('sel', e.dataset.id === sel.id));
      const un = save.data.unlocked[sel.id] || 0, best = save.data.best[sel.id + ':' + diff], low = game.lvl < sel.lvl[0] - 2;
      detail.replaceChildren(
        h('div', { style: 'font-size:1.6em;font-weight:900;color:#ffe8a8' }, sel.name, sel.hidden ? h('span', { class: 'small', style: 'color:#e0a0ff;margin-left:.6em' }, '隐藏地下城') : null),
        h('div', { class: 'dim small' }, `推荐等级 Lv.${sel.lvl[0]}~${sel.lvl[1]} · 领主：${MON[sel.boss.kind].name}（Lv.${sel.boss.lvl}）· 房间 ${sel.rooms}（最少消耗疲劳 ${sel.rooms}）`),
        h('div', { style: 'line-height:1.6;min-height:4.5em' }, sel.desc),
        low ? h('div', { class: 'small', style: 'color:#ff9a8a' }, `等级偏低（当前 Lv.${game.lvl}），怪物会非常强，建议先去前面的地下城练级`) : null,
        h('div', { class: 'diffs' }, DIFFS.map((D, i) => h('div', { class: 'diff' + (i === diff ? ' sel' : '') + (i > un ? ' lock' : ''), style: `color:${D.col}`, onclick: () => { if (i > un) { sfx.error(); return; } diff = i; sfx.click(); render(); } }, D.name, i > un ? h('div', { class: 'small dim' }, '🔒') : null))),
        h('div', { class: 'small dim' }, un < 3 ? `解锁下一难度：${['通关普通', '冒险难度评价 B 以上', '勇士难度评价 S 以上'][un]}` : '已解锁全部难度'),
        h('div', { class: 'row' }, h('span', {}, '最佳评价：'), h('b', { style: `color:${best ? RANK_COL[best] : '#777'};font-size:1.4em` }, best || '—'), h('span', { class: 'sp' }), h('span', { class: 'small' }, `疲劳 ${save.data.fatigue}/${FATIGUE_MAX}`)),
        h('div', { class: 'row' }, h('button', { class: 'btn big' + (save.data.fatigue < sel.rooms ? ' off' : ''), onclick: () => { sfx.click(); if (enterDungeon(sel.id, diff)) this.close('dungeon'); } }, '进入地下城'), h('button', { class: 'btn', onclick: () => { sfx.click(); this.close('dungeon'); } }, '取消')),
      );
    };
    const listEl = ids.length > 1 ? h('div', { class: 'dglist' }, ids.map(id => { const d = DUNGEONS[id]; return h('div', { class: 'dgi', 'data-id': d.id, onclick: () => { sel = d; diff = Math.min(diff, save.data.unlocked[d.id] || 0); sfx.click(); render(); } }, h('b', {}, d.name), h('small', {}, `Lv.${d.lvl[0]}~${d.lvl[1]}`)); })) : null;
    if (listEl) body.append(listEl); body.append(detail); render();
    return this.win(`${S.area || S.name || ''} · ${sel.name}`, body, { w: listEl ? 44 : 32 });
  },

  /* ---------------- 结算 + 翻牌 ---------------- */
  w_result(dg) {
    const R = dg.result, col = RANK_COL[R.rank];
    const lvCost = 400 + game.lvl * 150;
    const reward = (gold) => {
      const r = Math.random(), lv = dg.def.lvl[1];
      if (r < 0.4) return { gold: Math.round((80 + lv * 45) * (1 + dg.diff * 0.5) * rnd(0.8, 1.6) * (gold ? 2.5 : 1)) };
      if (r < 0.65) return { item: makeConsumable(pick(['hpM', 'mpM', 'crystal', 'elixir']), pick([1, 2, 3, 5])) };
      const rar = Math.min(5, rollRarity(0.15 + dg.D.drop + (gold ? 0.25 : 0), gold)); return { item: rar === 5 ? (() => { const pool = EPICS.filter(e => !e.cls || e.cls === game.player.cls), E = pick(pool); return makeEquip(E.slot, Math.max(E.lvl, lv), 5, game.player.cls, E); })() : makeEquip(pick(SLOTS), lv, Math.max(1, rar)) };
    };
    const rewards = [reward(false), reward(false), reward(true), reward(true)];
    let freePicked = false;
    const give = (rw) => { if (rw.gold) { game.gold += rw.gold; sfx.coin(); } else if (!giveItem(rw.item)) { /* 已自动出售 */ } else if ((rw.item.rar || 0) >= 5) sfx.epic(); save.write(); };
    const faceOf = (rw) => rw.gold ? [h('div', { style: 'font-size:2.2em' }, '💰'), h('b', { class: 'gold' }, `${fmtNum(rw.gold)} G`)] : [h('img', { src: itemIconURL(rw.item) }), h('b', { class: `r${rw.item.rar || 0}`, style: 'font-size:.85em' }, (rw.item.n > 1 ? rw.item.n + '× ' : '') + rw.item.name)];
    const cardEls = rewards.map((rw, i) => {
      const gold = i >= 2;
      const c = h('div', { class: 'card' + (gold ? ' goldc' : '') }, h('div', { class: 'in' }, h('div', { class: 'b' }, gold ? '★' : '?', gold ? h('div', { style: 'font-size:.35em' }, `${fmtNum(lvCost)} G`) : null), h('div', { class: 'f' }, ...faceOf(rw))));
      c.addEventListener('click', () => {
        if (c.classList.contains('flip')) return;
        if (!gold) {
          if (freePicked) return; freePicked = true; c.classList.add('flip'); sfx.card(); give(rw);
          const other = cardEls[1 - i]; setTimeout(() => { other.classList.add('flip', 'used'); other.style.opacity = 0.55; }, 600);
          btns.classList.remove('hidden'); goldHint.classList.remove('hidden');
        } else {
          if (!freePicked) { toastMsg('先从上排选择一张免费卡牌'); sfx.error(); return; }
          if (game.gold < lvCost) { toastMsg('金币不足'); sfx.error(); return; }
          game.gold -= lvCost; c.classList.add('flip', 'used'); sfx.card(); give(rw);
        }
      });
      return c;
    });
    const goldHint = h('div', { class: 'cardlbl hidden' }, `下排为黄金卡牌，每张 ${fmtNum(lvCost)} G`);
    const btns = h('div', { class: 'row hidden', style: 'margin-top:.8em' },
      h('button', { class: 'btn big', onclick: () => { sfx.click(); this.close('result'); lootAll(); const id = dg.def.id, d = dg.diff; if (!enterDungeon(id, d)) goTown(); } }, '再次挑战'),
      h('button', { class: 'btn big blue', onclick: () => { sfx.click(); this.close('result'); lootAll(); goTown(); } }, '返回城镇'));
    const el = h('div', { id: 'result' },
      h('div', { class: 'ttl' }, 'DUNGEON CLEAR!'),
      h('div', { class: 'dim' }, `${dg.def.name} · ${dg.D.name} · 用时 ${Math.floor(R.time / 60)}分${Math.floor(R.time % 60)}秒`),
      h('div', { class: 'rank', style: `color:${col}` }, R.rank),
      h('div', { class: 'line' }, h('span', {}, '操作 ', h('b', {}, R.S.ops)), h('span', {}, '技巧 ', h('b', {}, R.S.tech)), h('span', {}, '被击 ', h('b', { style: 'color:#ff8a8a' }, dg.hurt)), h('span', {}, '最高连击 ', h('b', {}, game.maxCombo))),
      h('div', { class: 'line' }, h('span', {}, '击杀经验 ', h('b', {}, fmtNum(dg.expGot))), h('span', {}, '通关经验 ', h('b', {}, fmtNum(R.clearExp))), h('span', {}, '评价加成 ', h('b', {}, `+${fmtNum(R.bonus)}`))),
      h('div', { class: 'cardlbl' }, '选择一张卡牌'),
      h('div', { class: 'cards' }, cardEls), goldHint, btns);
    game.paused = true;
    setTimeout(() => sfx.clear(), 200);
    return el;
  },

  /* ---------------- 角色与背包（I / M） ---------------- */
  w_inv(opts = {}) {
    const p = game.player, st = inv.equipStats();
    const eq = h('div', { class: 'eqgrid' }, SLOTS.map(s => this.slotEl(inv.equip[s], { extra: inv.equip[s] ? '' : SLOT_NAME[s], onclick: () => { if (inv.equip[s]) { inv.unwear(s); this.refresh('inv'); } } })));
    const cv = h('canvas', { width: 110, height: 130, style: 'width:6.9em;height:8.1em;image-rendering:pixelated;background:#120e16;border:.1em solid #3a3040' });
    requestAnimationFrame(() => { const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; x.translate(55, 124); p.model.draw(x, POSE.idle, game.t, {}); });
    const S = h('div', { class: 'stats' },
      '等级', h('b', {}, `Lv.${game.lvl}`), 'HP', h('b', {}, `${fmtNum(p.hp)} / ${fmtNum(p.hpMax)}`), 'MP', h('b', {}, `${fmtNum(p.mp)} / ${fmtNum(p.mpMax)}`),
      '攻击力', h('b', {}, fmtNum(p.baseStats ? p.baseStats.atk : p.atk)), '防御力', h('b', {}, fmtNum(p.def)), '力量', h('b', {}, fmtNum(CLASSES[p.cls].str0 + CLASSES[p.cls].strPer * (game.lvl - 1) + st.str)),
      '暴击率', h('b', {}, (p.crit * 100).toFixed(1) + '%'), '暴击伤害', h('b', {}, (p.critDmg * 100).toFixed(0) + '%'), 'SP', h('b', {}, String(game.sp || 0)), '金币', h('b', { class: 'gold' }, `${fmtNum(game.gold)} G`));
    let sel = this.sel && inv.items.includes(this.sel) ? this.sel : null;
    const grid = h('div', { class: 'grid' });
    for (let i = 0; i < inv.cap; i++) {
      const it = inv.items[i];
      grid.appendChild(this.slotEl(it, { sel: it && it === sel, onclick: () => { if (it) { this.sel = it; this.refresh('inv'); } }, ondbl: () => { if (!it) return; if (it.kind === 'equip') inv.wear(it); else if (it.kind === 'use') inv.use(it.key); this.sel = null; this.refresh('inv'); } }));
    }
    const shopMode = this.isOpen('shop') || this.isOpen('gear');
    const acts = h('div', { class: 'row', style: 'min-height:2.4em;flex-wrap:wrap' });
    if (sel) {
      acts.append(h('span', { class: `r${sel.rar || 0}`, style: 'font-weight:800' }, sel.name));
      if (sel.kind === 'equip') acts.append(h('button', { class: 'btn', onclick: () => { inv.wear(sel); this.sel = null; this.refresh('inv'); } }, '装备'));
      if (sel.kind === 'use') { acts.append(h('button', { class: 'btn', onclick: () => { inv.use(sel.key); this.refresh('inv'); } }, '使用')); acts.append(h('span', { class: 'small dim' }, '放入快捷栏：'), h('div', { class: 'keyrow' }, [0, 1, 2, 3, 4, 5].map(i => h('span', { class: 'key' + (inv.quick[i] === sel.key ? ' on' : ''), onclick: () => { inv.quick[i] = inv.quick[i] === sel.key ? null : sel.key; sfx.click(); this.refresh('inv'); } }, String(i + 1))))); }
      acts.append(h('button', { class: 'btn red', onclick: () => { const price = Math.round((sel.price || 10) * 0.2) * (sel.n || 1); game.gold += price; inv.remove(sel); this.sel = null; sfx.coin(); toastMsg(`出售获得 ${fmtNum(price)} G`, '#ffd23a'); this.refresh('inv'); save.write(); } }, shopMode ? '出售' : '出售（×0.2）'));
    } else acts.append(h('span', { class: 'small dim' }, '单击选中物品，双击直接装备 / 使用；点击装备栏卸下装备'));
    const body = h('div', { class: 'row', style: 'align-items:flex-start;gap:1.2em' },
      h('div', { class: 'col', style: 'align-items:center' }, cv, eq), h('div', { class: 'col' }, S),
      h('div', { class: 'col' }, h('div', { class: 'row' }, h('b', { class: 'gold' }, '背包'), h('span', { class: 'sp' }), h('span', { class: 'small dim' }, `${inv.items.length}/${inv.cap}`)), grid, acts));
    const el = this.win('角色 · 背包', body, { w: 58 }); el._arg = opts; return el;
  },

  /* ---------------- 技能（K） ---------------- */
  w_skills() {
    const cls = game.player.cls, ids = CLASSES[cls].skills;
    let sel = this.skSel && ids.includes(this.skSel) ? this.skSel : ids[0];
    const list = h('div', { class: 'sklist' }, ids.map(id => {
      const S = SKILLS[id], lv = game.skillLv[id] || 0, lock = S.lvReq > game.lvl, cost = skillCost(S, lv);
      const img = h('img', { src: skillIcon(id).toDataURL() });
      const up = h('button', { class: 'btn' + (lock || lv >= S.maxLv || (game.sp || 0) < cost ? ' off' : ''), style: 'padding:.2em .6em', onclick: (ev) => { ev.stopPropagation(); if (lock || lv >= S.maxLv || (game.sp || 0) < cost) return; game.sp -= cost; game.skillLv[id] = lv + 1; if (!game.skillBar.includes(id)) { const k = game.skillBar.indexOf(null); if (k >= 0) game.skillBar[k] = id; } sfx.buff(); save.write(); this.refresh('skills'); } }, lv ? '升级' : '学习');
      return h('div', { class: 'ski' + (lock ? ' lock' : '') + (id === sel ? ' sel' : ''), style: id === sel ? 'border-color:#e8c26a' : '', onclick: () => { this.skSel = id; sfx.click(); this.refresh('skills'); } },
        img, h('div', { class: 'd' }, h('b', {}, S.name), ` Lv.${lv}/${S.maxLv}`, h('br'), lock ? `需要等级 ${S.lvReq}` : `SP ${cost} · MP ${S.mp} · 冷却 ${S.cd}s`, h('br'), S.cmdTxt ? h('span', { class: 'gold' }, S.cmdTxt) : ''), up);
    }));
    const S = SKILLS[sel];
    const keys = h('div', { class: 'keyrow' }, SKILL_KEYS.map((k, i) => h('span', { class: 'key' + (game.skillBar[i] === sel ? ' on' : ''), onclick: () => { const j = game.skillBar.indexOf(sel); if (j >= 0) game.skillBar[j] = null; game.skillBar[i] = sel; sfx.click(); save.write(); this.refresh('skills'); } }, k)));
    const body = h('div', { class: 'col' },
      h('div', { class: 'row' }, h('b', { class: 'gold' }, `剩余 SP：${game.sp || 0}`), h('span', { class: 'sp' }), h('button', { class: 'btn', onclick: () => { let back = 0; for (const id of ids) { const lv = game.skillLv[id] || 0; for (let l = CLASSES[cls].start.includes(id) ? 1 : 0; l < lv; l++) back += skillCost(SKILLS[id], l); game.skillLv[id] = CLASSES[cls].start.includes(id) ? 1 : 0; } game.sp = (game.sp || 0) + back; game.skillBar = game.skillBar.map(id => id && game.skillLv[id] ? id : null); save.write(); this.refresh('skills'); } }, '重置技能')),
      list,
      h('div', { class: 'col', style: 'border-top:.1em solid #3a3040;padding-top:.5em' }, h('div', {}, h('b', { style: 'color:#ffe8a8' }, S.name), h('span', { class: 'dim small' }, `  ${S.desc}`)), h('div', { class: 'row small' }, '设置快捷键：', keys)));
    return this.win('技能', body, { w: 46 });
  },

  /* ---------------- 商店（药剂师） ---------------- */
  w_shop(arg) {
    const npc = arg && arg.npc; if (arg && arg.shop === 'linus') return this.w_gear(npc);
    const goods = ['hpS', 'hpM', 'hpL', 'mpS', 'mpM', 'elixir', 'crystal', 'guard', 'coin'];
    const body = h('div', { class: 'col' },
      h('div', { class: 'dim' }, npc ? `“${pick(npc.lines)}”` : ''),
      h('div', { class: 'col', style: 'max-height:26em;overflow:auto' }, goods.map(k => {
        const C = CONSUMABLES[k], it = { kind: C.kind, key: k, rar: k === 'elixir' ? 3 : 0 };
        const buy = (n) => { const cost = C.price * n; if (game.gold < cost) { toastMsg('金币不足'); sfx.error(); return; } if (k === 'coin') { game.gold -= cost; save.data.coins += n; } else if (!inv.add(makeConsumable(k, n))) { toastMsg('背包已满'); return; } else game.gold -= cost; sfx.coin(); save.write(); this.refresh('shop', npc); this.refresh('inv'); };
        return h('div', { class: 'shopi' }, h('img', { src: itemIconURL(it) }), h('div', { class: 'sp' }, h('b', {}, C.name), h('div', { class: 'small gold' }, `${fmtNum(C.price)} G`), h('div', { class: 'small dim' }, k === 'coin' ? `持有 ${save.data.coins}` : `持有 ${inv.count(k)}`)),
          h('button', { class: 'btn', onclick: () => buy(1) }, '购买'), h('button', { class: 'btn', onclick: () => buy(10) }, '×10'));
      })),
      h('div', { class: 'row' }, h('b', { class: 'gold' }, `金币 ${fmtNum(game.gold)} G`), h('span', { class: 'sp' }), h('button', { class: 'btn blue', onclick: () => this.open('inv') }, '打开背包（出售物品）')));
    const el = this.win(npc ? npc.name : '商店', body, { w: 30 }); el._arg = arg; return el;
  },
  /* ---------------- 行商（装备） ---------------- */
  w_gear(npc) {
    if (!shopStock.stock || shopStock.stockLvl !== game.lvl) { shopStock.stockLvl = game.lvl; shopStock.stock = Array.from({ length: 6 }, (_, i) => { const it = makeEquip(i === 0 ? 'weapon' : pick(SLOTS), clamp(game.lvl + rndi(0, 2), 1, 30), i < 2 ? 2 : 1); it.price = Math.round(it.price * 1.6); return it; }); }
    const body = h('div', { class: 'col' },
      h('div', { class: 'dim' }, `“${pick(npc.lines)}”`),
      h('div', { class: 'col' }, shopStock.stock.map(it => h('div', { class: 'shopi' }, this.slotEl(it), h('div', { class: 'sp' }, h('b', { class: `r${it.rar}` }, it.name), h('div', { class: 'small dim' }, `${SLOT_NAME[it.slot]} · Lv.${it.lvl}`), h('div', { class: 'small gold' }, `${fmtNum(it.price)} G`)),
        h('button', { class: 'btn', onclick: (ev) => { if (ev.currentTarget.classList.contains('off')) return; if (game.gold < it.price) { toastMsg('金币不足'); sfx.error(); return; } if (!inv.add(it)) { toastMsg('背包已满'); return; } ev.currentTarget.classList.add('off'); game.gold -= it.price; shopStock.stock.splice(shopStock.stock.indexOf(it), 1); sfx.coin(); save.write(); this.refresh('gear', npc); this.refresh('inv'); } }, '购买')))),
      h('div', { class: 'row' }, h('b', { class: 'gold' }, `金币 ${fmtNum(game.gold)} G`), h('span', { class: 'sp' }), h('button', { class: 'btn blue', onclick: () => this.open('inv') }, '打开背包')));
    const el = this.win(npc.name, body, { w: 32 }); el._arg = npc; return el;
  },
  /* ---------------- 强化（铁匠） ---------------- */
  w_enhance(npc) {
    const all = [...SLOTS.map(s => inv.equip[s]).filter(Boolean), ...inv.items.filter(i => i.kind === 'equip')];
    let sel = this.enSel && all.includes(this.enSel) ? this.enSel : all[0];
    this.enSel = sel;
    const grid = h('div', { class: 'grid', style: 'grid-template-columns:repeat(6,3.3em)' }, all.map(it => this.slotEl(it, { sel: it === sel, onclick: () => { this.enSel = it; this.refresh('enhance', npc); } })));
    const right = h('div', { class: 'col', style: 'width:20em;align-items:center' });
    if (sel) {
      const c = enhCost(sel), rate = sel.enh < 15 ? ENH_RATE[sel.enh] : 0;
      const bar = h('i'), msg = h('div', { class: 'bigtxt', style: 'min-height:1.4em' });
      let useGuard = false;
      const guardBox = h('label', { class: 'small' }, h('input', { type: 'checkbox', onchange: e => { useGuard = e.target.checked; } }), ` 使用强化保护券（+10 以上失败时生效，持有 ${inv.count('guard')}）`);
      const risk = sel.enh < 3 ? '失败不会降级' : sel.enh < 10 ? '失败会降 1 级' : sel.slot === 'weapon' && sel.enh < 12 ? `失败会降为 +${sel.enh === 10 ? 7 : 8}` : '⚠ 失败装备会破碎！';
      const go = h('button', { class: 'btn big' + (sel.enh >= 15 ? ' off' : ''), onclick: () => {
        go.classList.add('off');
        const cost = enhCost(sel); if (game.gold < cost.gold || inv.count('crystal') < cost.crystal) { toastMsg('材料或金币不足'); sfx.error(); go.classList.remove('off'); return; }
        sfx.charge(); bar.style.transition = 'width 1.1s linear'; bar.style.width = '100%';
        setTimeout(() => {
          const owned = inv.items.includes(sel) || SLOTS.some(s => inv.equip[s] === sel);
          if (!owned || !this.isOpen('enhance')) return;
          const res = tryEnhance(sel, useGuard);
          if (res.err) { toastMsg(res.err); go.classList.remove('off'); return; }
          if (res.ok) { msg.textContent = `成功！+${res.lvl}`; msg.style.color = '#6aff8a'; sfx.enhanceOk(); if (res.lvl >= 10) toastMsg(`【公告】勇士将 ${sel.name} 强化到了 +${res.lvl}！`, '#ffd23a'); }
          else if (res.broken) { msg.textContent = '装备破碎……'; msg.style.color = '#ff4a4a'; sfx.enhanceFail(); for (const s of SLOTS) if (inv.equip[s] === sel) delete inv.equip[s]; inv.remove(sel); giveItem(makeConsumable('crystal', Math.round(sel.lvl * 3))); this.enSel = null; recalcStats(game.player); }
          else { msg.textContent = res.guard ? `失败（保护券生效）+${res.lvl}` : `失败 +${res.from} → +${res.lvl}`; msg.style.color = '#ff8a8a'; sfx.enhanceFail(); }
          recalcStats(game.player); save.write();
          setTimeout(() => this.refresh('enhance', npc), 900);
        }, 1150);
      } }, '强化');
      right.append(this.slotEl(sel), h('div', { class: `r${sel.rar}`, style: 'font-weight:900;font-size:1.2em' }, sel.name),
        h('div', { class: 'bigtxt' }, `+${sel.enh} → +${Math.min(15, sel.enh + 1)}`),
        h('div', {}, `成功率 `, h('b', { style: 'color:#ffe070' }, `${(rate * 100).toFixed(1)}%`), h('span', { class: 'small dim' }, `  （${risk}）`)),
        h('div', { class: 'small' }, `消耗：${fmtNum(c.gold)} G + 无色晶块 ×${c.crystal}（持有 ${inv.count('crystal')}）`), guardBox,
        h('div', { class: 'enhbar', style: 'width:100%' }, bar), go, msg);
    } else right.append(h('div', { class: 'dim' }, '没有可以强化的装备'));
    const body = h('div', { class: 'col' }, h('div', { class: 'dim' }, `“${pick(npc ? npc.lines : ['来强化吧'])}”`), h('div', { class: 'row', style: 'align-items:flex-start;gap:1em' }, grid, right));
    const el = this.win(npc ? npc.name + ' · 装备强化' : '装备强化', body, { w: 46 }); el._arg = npc; return el;
  },
  /* ---------------- 系统菜单 / 操作说明 ---------------- */
  w_system() {
    const vol = (label, key) => h('label', { class: 'row' }, h('span', { style: 'width:4em' }, label), h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: save.data ? save.data.opts[key] : 0.7, oninput: e => { const v = +e.target.value; if (save.data) save.data.opts[key] = v; applyVolumes(); } }));
    const body = h('div', { class: 'col', style: 'width:22em' },
      h('button', { class: 'btn big', onclick: () => this.close('system') }, '继续游戏'),
      h('button', { class: 'btn', onclick: () => { this.close('system'); this.open('help'); } }, '操作说明'),
      vol('音乐', 'music'), vol('音效', 'sfx'),
      h('button', { class: 'btn', onclick: () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {}); } }, '全屏切换'),
      game.scene === 'dungeon' ? h('button', { class: 'btn red', onclick: () => { this.close('system'); game.paused = false; if (game.dungeon && game.dungeon.state === 'dead') { game.dungeon.fail(); return; } lootAll(); goTown(); } }, '放弃并返回城镇') : null,
      h('button', { class: 'btn blue', onclick: () => { save.write(); this.close('system'); location.href = location.pathname; } }, '返回标题'));
    return this.win('系统菜单', body);
  },
  w_help() {
    const cmds = CLASSES[game.player ? game.player.cls : 'sword'].cmds.map(([seq, id]) => `${cmdText(seq)}+Z：${SKILLS[id].name}`).join('　');
    const body = h('div', { class: 'help' },
      h('b', {}, '← → ↑ ↓'), '移动（↑↓ 在纵深方向移动），快速双击 ←/→ 奔跑', h('b', {}, 'X'), '普通攻击（连按出连段）／奔跑中按 X 冲刺攻击，再按 X 连突刺／站在物品上按 X 拾取',
      h('b', {}, 'C'), '跳跃（空中按 X 跳跃攻击）', h('b', {}, 'Shift / V'), '闪避翻滚：朝方向键方向（包括上下）翻滚，全程无敌；普攻和技能后摇中也能用，挨打硬直中也能紧急闪避（冷却 5 秒）',
      h('b', {}, '↓ + C'), '后跳（短暂无敌）', h('b', {}, '倒地时 C'), '受身：立即起身并无敌 1 秒（冷却 2.5 秒）',
      h('b', {}, 'A S D F G H / Q W E R T Y'), '技能快捷栏（可以在技能窗口 K 里设置）', h('b', {}, 'Z / 空格 + 方向'), cmds,
      h('b', {}, '1 ~ 6'), '快捷物品栏（药剂）', h('b', {}, 'I / M'), '角色与背包', h('b', {}, 'K'), '技能', h('b', {}, 'Esc'), '系统菜单',
      h('b', {}, '躲避技巧'), '领主头顶出现红色“!”是霸体重招，赶紧闪避；地上的黄圈 / 红色六芒星 / 冲撞路线是预警，看到就躲开；地震、陨石、爆炸这类地面攻击可以跳起来躲；4 秒没挨打会自动回血。',
      h('b', {}, '战斗技巧'), '技能可以随时取消普攻；打断正在出招的敌人触发 COUNTER（伤害 ×1.25）；从背后攻击触发 BACK ATTACK；把敌人挑到空中连击可以提高评价。');
    return this.win('操作说明', body, { w: 52 });
  },
};
const cmdText = seq => seq === '' ? '' : seq === 'hold' ? '按住→' : seq.split('').map(ch => ({ f: '→', b: '←', d: '↓', u: '↑' })[ch]).join('');
const skillCost = (S, lv) => Math.round((S.spBase || (S.awaken ? 120 : 20)) * (1 + lv * 0.25));
function applyVolumes() { if (!save.data || !sfx.ctx) return; sfx.bus.gain.value = save.data.opts.sfx; sfx.mus.gain.value = save.data.opts.music; }
function lootAll() { let n = 0; for (const d of drops) { if (d.kind === 'gold') { game.gold += d.amount; n++; } else if (inv.add(d.item)) n++; } drops.length = 0; if (n) toastMsg(`自动拾取了 ${n} 件掉落物`, '#ffe8a8'); }
function menuKey(code) {
  if (game.scene === 'title' || menus.isOpen('result') || menus.isOpen('newgame') || menus.isOpen('title')) return;
  if (code === 'Escape') { menus.closeTop(); sfx.click(); }
  else if (code === 'KeyI' || code === 'KeyM') { menus.open('inv'); sfx.open(); }
  else if (code === 'KeyK') { menus.open('skills'); sfx.open(); }
}
addEventListener('keydown', e => { if (!e.repeat) menuKey(e.code); });
