/* =====================================================================
   个人信息（M）：纸娃娃（12 个装备栏围绕角色立绘）+ 四维与全部属性、防具精通、套装效果
   装备栏：拖进来 = 穿戴，右键 / 拖回背包 = 卸下
   ===================================================================== */
addStyle(`
.stwrap{display:flex;gap:.8em;align-items:flex-start}
.doll{display:grid;grid-template-columns:3.3em 10.5em 3.3em;grid-template-rows:repeat(5,3.3em) 3.3em;gap:.25em .4em;padding:.5em;background:radial-gradient(ellipse at 50% 45%,#2e2638,#0e0b12 75%);border:.1em solid #4a3c2c;border-radius:.3em}
.doll .islot{width:3.3em;height:3.3em}
.doll .pt{grid-column:2;grid-row:1 / span 5;display:grid;place-items:end center;position:relative;overflow:hidden}
.doll .pt img{max-width:100%;max-height:100%;object-fit:contain;filter:drop-shadow(0 .3em .5em #000)}
.doll .pt canvas{width:9em;height:11em;image-rendering:pixelated}
.doll .pt canvas.avcv{width:10.4em;height:13em;image-rendering:auto;filter:drop-shadow(0 .3em .5em #000)}
.doll .pt .ttl{position:absolute;top:.1em;left:0;right:0;text-align:center;font-size:.72em;font-weight:900;text-shadow:0 0 .3em #000,0 0 .3em #000}
.doll .sp2{grid-column:2;grid-row:6;display:flex;gap:.4em;justify-content:center}
.stpanel{width:21em}
.stname{font-size:1.15em;font-weight:900;color:#ffe8a8}
.stname small{font-size:.7em;color:#9a8f7c;margin-left:.4em}
.sttbl{display:grid;grid-template-columns:1fr auto 1fr auto;gap:.12em .6em;font-size:.84em;background:#0c0a10;border:.1em solid #3a3040;border-radius:.25em;padding:.4em .6em}
.sttbl span{color:#b8ac90}.sttbl b{text-align:right;color:#fff2d0;font-weight:800}
.sttbl .hd{grid-column:1 / -1;color:#e8c26a;font-weight:900;border-bottom:.08em solid #3a3040;margin:.2em 0 .1em}
.sttbl b.up{color:#8aff8a}.sttbl b.bad{color:#ff7a6a}
.stscore{display:flex;align-items:center;gap:.5em;padding:.3em .6em;border-radius:.25em;background:linear-gradient(90deg,rgba(120,80,10,.55),rgba(20,14,8,.6));border:.1em solid #8a6a2a;font-size:.9em;color:#e8d8b0}
.stscore b{color:#ffe070;font-size:1.25em;text-shadow:0 0 .4em rgba(255,200,60,.5)}.stscore .sp{flex:1}
.stsets{font-size:.8em;line-height:1.5;background:#0c0a10;border:.1em solid #3a3040;border-radius:.25em;padding:.35em .6em;max-height:7em;overflow:auto}
`);
const DOLL_LEFT = ['head', 'top', 'bottom', 'belt', 'shoes'], DOLL_RIGHT = ['weapon', 'title', 'bracelet', 'neck', 'ring'], DOLL_BOTTOM = ['support', 'stone'];
const AV_LEFT = ['av_hair', 'av_hat', 'av_face', 'av_chest'], AV_RIGHT = ['av_top', 'av_bottom', 'av_belt', 'av_shoes'];
function equipSlotEl(slot, win) {
  const it0 = inv.equip[slot], it = it0 && it0.slot === slot ? it0 : null;
  return itemSlot(it, {
    label: SLOT_NAME[slot], cmp: false, worn: true,
    onRight: () => { if (it && inv.unwear(slot)) { save.write(); itemsRefresh(); } },
    onDbl: () => { if (it && inv.unwear(slot)) { save.write(); itemsRefresh(); } },
    drag: it ? () => ({ type: 'item', item: it, from: 'equip', slot }) : null,
    drop: { accept: p => p.type === 'item' && p.from === 'inv' && p.item.kind === 'equip' && p.item.slot === slot, drop: p => { if (inv.wear(p.item)) { save.write(); itemsRefresh(); } } },
  });
}
function statusJobName() { const C = CLASSES[game.player.cls]; const J = game.job && C.jobs && C.jobs[game.job]; return J ? J.name : C.name; }
Object.assign(menus, {
  w_status() {
    inv.ensure();
    const el = itemWin('status', '个人信息', el => {
      const p = game.player; if (!p) return [];
      recalcStats(p);
      const S = p.stats || {}, pct = v => Math.abs(v) < 1e-4 ? '0%' : (v * 100).toFixed(1) + '%', mul = v => Math.abs(v - 1) < 1e-4 ? '0%' : `${v >= 1 ? '+' : ''}${((v - 1) * 100).toFixed(1)}%`;
      // 纸娃娃
      const av = IW.dollPage === 'avatar', doll = h('div', { class: 'doll' });
      (av ? AV_LEFT : DOLL_LEFT).forEach((s, i) => { const e = equipSlotEl(s, el); e.style.gridColumn = 1; e.style.gridRow = i + 1; doll.append(e); });
      (av ? AV_RIGHT : DOLL_RIGHT).forEach((s, i) => { const e = equipSlotEl(s, el); e.style.gridColumn = 3; e.style.gridRow = i + 1; doll.append(e); });
      const pages = h('div', { class: 'itabs', style: 'margin-bottom:.3em' }, [['gear', '装备'], ['avatar', '时装']].map(([id, nm]) => h('div', { class: 'itab' + ((IW.dollPage || 'gear') === id ? ' on' : ''), onclick: () => { IW.dollPage = id; sfx.click(); el._render(); } }, nm)));
      const t = inv.equip.title;
      const pt = h('div', { class: 'pt' }, t ? h('div', { class: `ttl q${t.rar}` }, `【${t.name}】`) : null);
      const art = IMG[`class/${p.cls}`];
      // 外观与换装组的接口：按当前武器 / 时装画站姿小人（没有这个模块时用职业立绘）
      if (typeof avatarCanvas === 'function' && typeof lookFromEquip === 'function' && SPR_DATA[p.cls]) {
        const cv = avatarCanvas(p.cls, lookFromEquip(p.cls, inv.equip), 200, 250, 1.75); cv.classList.add('avcv'); pt.append(cv);
      } else if (art) pt.append(h('img', { src: art.src }));
      else { const cv = h('canvas', { width: 110, height: 134 }); requestAnimationFrame(() => { const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; x.translate(55, 128); p.model.draw(x, (p.clips && p.clips.idle && p.clips.idle.keys) ? p.clips.idle.keys[0][1] : POSE.idle, game.t, {}); }); pt.append(cv); }
      doll.append(pt, h('div', { class: 'sp2' }, av ? [] : DOLL_BOTTOM.map(s => equipSlotEl(s, el))));
      // 属性表
      const row = (a, b, cls = '') => [h('span', {}, a), h('b', { class: cls }, b)];
      const tbl = h('div', { class: 'sttbl' },
        h('div', { class: 'hd' }, '基础属性'),
        ...row('HP', `${fmtNum(p.hpMax)}`), ...row('MP', `${fmtNum(p.mpMax)}`),
        ...row('物理攻击', fmtNum(S.atk)), ...row('魔法攻击', fmtNum(S.matk)),
        ...row('独立攻击', fmtNum(S.indep)), ...row('物理防御', fmtNum(S.def)),
        ...row('魔法防御', fmtNum(S.mdef)), ...row('力量', fmtNum(S.str)),
        ...row('智力', fmtNum(S.int)), ...row('体力', fmtNum(S.vit)),
        ...row('精神', fmtNum(S.spr)), ...row('暴击伤害', `+${Math.round((S.critDmg - 1) * 100)}%`),
        h('div', { class: 'hd' }, '详细属性'),
        ...row('物理暴击', pct(S.crit)), ...row('魔法暴击', pct(S.mcrit)),
        ...row('攻击速度', mul(S.aspd), S.aspd > 1 ? 'up' : S.aspd < 1 ? 'bad' : ''), ...row('施放速度', mul(S.cspd), S.cspd > 1 ? 'up' : S.cspd < 1 ? 'bad' : ''),
        ...row('移动速度', mul(S.mspd), S.mspd > 1 ? 'up' : ''), ...row('命中率', S.hitRate ? `+${pct(S.hitRate)}` : '0%'),
        ...row('回避率', S.evade ? `+${pct(S.evade)}` : '0%'), ...row('硬直', fmtNum(S.hardness)),
        ...row('僵直度', fmtNum(S.stagger)), ...row('伤害增加', S.dmgUp ? `+${pct(S.dmgUp)}` : '0%'),
        ...row('技能冷却', S.cdr ? `-${pct(S.cdr)}` : '0%'), ...row('受到伤害', S.dmgTaken < 1 ? `-${pct(1 - S.dmgTaken)}` : '0%'),
        h('div', { class: 'hd' }, '属性强化 / 抗性'),
        ...row('火 / 冰', `${S.elem.fire} / ${S.elem.ice}`), ...row('光 / 暗', `${S.elem.light} / ${S.elem.dark}`),
        ...row('火抗 / 冰抗', `${S.res.fire} / ${S.res.ice}`), ...row('光抗 / 暗抗', `${S.res.light} / ${S.res.dark}`));
      const sets = (p.sets || []).map(x => { const Sd = SETS[x.id]; return Sd ? h('div', {}, h('b', { style: 'color:var(--qset)' }, `${Sd.name}（${x.n}/${Sd.pieces.length}）`), ' ', x.on.length ? x.on.map(n => `${n} 件：${Sd.bonus[n].desc || ''}`).join('；') : h('span', { class: 'dim' }, '未激活')) : null; }).filter(Boolean);
      const broken = durItems().filter(x => x.dur <= 0);
      const info = h('div', { class: 'stsets' },
        h('div', {}, '防具精通：', h('b', { class: 'gold' }, (ATYPES[p.mastery] || {}).name || '-'), ` ${p.masteryN || 0}/5 件`, h('span', { class: 'dim' }, p.masteryN ? '（每件都有额外加成）' : '（穿上精通类型的防具有额外加成）')),
        ...sets,
        broken.length ? h('div', { style: 'color:#ff6a6a' }, `耐久度为 0：${broken.map(x => x.name).join('、')}（属性失效，请修理）`) : null,
        p.weak ? h('div', { style: 'color:#ff9a8a' }, '虚弱中：攻击、防御、HP 上限 -25%') : null);
      const cs = codexStats();
      const score = h('div', { class: 'stscore' }, h('span', {}, '装备评分 ', h('b', {}, fmtNum(gearScore()))), h('span', { class: 'sp' }), h('span', { class: 'small' }, `图鉴 史诗 ${cs.epic}/${cs.epicTotal}`),
        h('button', { class: 'btn sm blue', onclick: () => { sfx.click(); if (!menus.isOpen('codex')) menus.open('codex'); } }, '装备图鉴'));
      const panel = h('div', { class: 'stpanel col', style: 'gap:.35em' },
        h('div', { class: 'stname' }, `${save.data ? save.data.name : ''}`, h('small', {}, `Lv.${game.lvl} ${statusJobName()}`)),
        score, tbl, info);
      return [h('div', { class: 'stwrap' }, h('div', {}, pages, doll), panel), h('div', { class: 'ihint' }, '把背包里的装备拖到对应的格子上穿戴；右键装备栏卸下。')];
    }, { w: 42, at: 'left' });
    return el;
  },
});
