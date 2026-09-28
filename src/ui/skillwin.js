/* =====================================================================
   技能窗口 K（官方式）
   - 页签：基础技能（SKILLS[id].job 为空）/ 转职技能（当前 game.job 的技能）
   - SP、学习 / 升级（+）/ 降级（-）、等级要求、前置技能、说明；提示框显示当前级和下一级的数值
   - 技能图标拖到技能栏（窗口下方的技能栏预览，或屏幕下方 HUD 的技能栏）；右键技能图标 = 锁定 / 解锁指令释放
   技能数据由「战斗与动作」提供，字段都按可选处理：name desc lvReq maxLv mp cd job passive awaken type elem pre spCost info act
   ===================================================================== */
const SK_TYPE = { phys: '物理', mag: '魔法', indep: '独立攻击' };
const SK_ELEM = { fire: '火', ice: '冰', light: '光', dark: '暗' };
// 当前职业（+ 转职）能看到的技能：{ base: [...], job: [...] }
function skillPages(cls = game.player && game.player.cls, job = game.job) {
  const C = CLASSES[cls] || {}, ok = id => !!SKILLS[id];
  const base = (C.skills || []).filter(id => ok(id) && !SKILLS[id].job && (typeof skillAllowed !== 'function' || skillAllowed(id, job)));
  let jobs = [];
  if (job) {
    const J = C.jobs && C.jobs[job];
    jobs = J && J.skills ? J.skills.filter(ok) : Object.keys(SKILLS).filter(id => SKILLS[id].job === job && (!SKILLS[id].cls || SKILLS[id].cls === cls));
  }
  return { base, job: jobs };
}
const skMin = id => { const C = game.player && CLASSES[game.player.cls], J = C && C.jobs && game.job && C.jobs[game.job]; return C && ((C.start || []).includes(id) || (J && J.auto && J.auto.includes(id))) ? 1 : 0; };
const skCost = (S, lv) => { try { if (typeof S.spCost === 'function') return Math.max(0, Math.round(S.spCost(lv))); } catch (e) { /* 回退 */ } return skillCost(S, lv); };
const skLvReq = (S, lv) => skillLvReq(S, lv);   // 学到第 lv 级需要的角色等级（规则在 game/progress.js：Lv30 以后普通主动技能上限继续涨）
const skCmd = id => { if (typeof cmdTextOf === 'function') return cmdTextOf(id) || ''; const C = game.player && CLASSES[game.player.cls], c = C && (C.cmds || []).find(x => x[1] === id); if (!c) return ''; const k = keyName({ attack: 'attack', buff: 'cmdB', jump: 'jump' }[c[2]] || 'cmd'); return c[0] === '' ? k : cmdText(c[0]) + '+' + k; };
const cmdLocked = id => !!(save.data && save.data.opts && save.data.opts.cmdLock && save.data.opts.cmdLock[id]);
// 为什么不能升级（返回 null 表示可以）
function skillUpBlock(id) {
  const S = SKILLS[id], lv = game.skillLv[id] || 0;
  if (!S) return '未知技能';
  if (S.job && S.job !== game.job) return '需要转职';
  if (typeof skillAllowed === 'function' && !skillAllowed(id, game.job)) return '该转职无法学习';
  if (lv >= skillMaxLv(S)) return '已满级';
  const need = skLvReq(S, lv + 1); if (game.lvl < need) return `需要等级 ${need}`;
  if (typeof tierOf === 'function' ? !tierUnlocked(tierOf(S)) : (S.awaken && typeof awakenUnlocked === 'function' && !awakenUnlocked())) return `需要完成${(typeof TIER_NAME !== 'undefined' && TIER_NAME[tierOf(S)]) || '觉醒'}任务`;
  for (const pid in S.pre || {}) if ((game.skillLv[pid] || 0) < S.pre[pid]) return `需要 ${SKILLS[pid] ? SKILLS[pid].name : pid} Lv.${S.pre[pid]}`;
  if ((game.sp || 0) < skCost(S, lv)) return 'SP 不足';
  return null;
}
function skillDownBlock(id) {
  const lv = game.skillLv[id] || 0;
  if (lv <= skMin(id)) return lv ? '初始技能不能降到 0 级' : '未学习';
  for (const k in SKILLS) { const S = SKILLS[k]; if ((game.skillLv[k] || 0) > 0 && S.pre && S.pre[id] >= lv) return `${S.name} 需要这个技能 Lv.${S.pre[id]}`; }
  return null;
}
function skillUp(id) {
  const why = skillUpBlock(id); if (why) { toastMsg(why, '#ffb0a0'); sfx.error(); return false; }
  const S = SKILLS[id], lv = game.skillLv[id] || 0;
  game.sp -= skCost(S, lv); game.skillLv[id] = lv + 1;
  if (!lv && !S.passive && !game.skillBar.includes(id)) { const k = game.skillBar.indexOf(null); if (k >= 0) game.skillBar[k] = id; }
  if (S.passive && typeof recalcStats === 'function' && game.player) recalcStats(game.player);
  sfx.buff(); save.write(); return true;
}
function skillDown(id) {
  const why = skillDownBlock(id); if (why) { toastMsg(why, '#ffb0a0'); sfx.error(); return false; }
  const S = SKILLS[id], lv = game.skillLv[id];
  game.sp = (game.sp || 0) + skCost(S, lv - 1); game.skillLv[id] = lv - 1;
  if (!game.skillLv[id]) game.skillBar = game.skillBar.map(x => x === id ? null : x);
  if (S.passive && typeof recalcStats === 'function' && game.player) recalcStats(game.player);
  sfx.click(); save.write(); return true;
}
// 技能数值（当前级 / 下一级）：优先 S.info(lv, p)，否则从 act(lv) 的判定里推算
function skillInfo(id, lv) {
  const S = SKILLS[id]; if (!S || lv <= 0) return [];
  try { if (typeof S.info === 'function') return (S.info(lv, game.player) || []).map(x => Array.isArray(x) ? x : [String(x), '']); } catch (e) { /* 回退 */ }
  const out = [];
  try {
    if (S.act && !S.passive) {
      const a = S.act(lv, game.player), hits = (a && a.hits) || [], sum = hits.reduce((s, x) => s + (+x.dmg || 0), 0);
      if (sum > 0) out.push([S.type === 'mag' ? '魔法攻击' : '物理攻击', `${Math.round(sum * 100)}%` + (hits.length > 1 ? `（${hits.length} 段）` : '')]);
    }
  } catch (e) { /* 部分技能的动作需要战斗上下文，算不出来就不显示 */ }
  return out;
}
function skillTipHtml(id) {
  const S = SKILLS[id]; if (!S) return '';
  const lv = game.skillLv[id] || 0, max = skillMaxLv(S), cmd = skCmd(id), detail = uiPref('tipDetail');
  const kind = S.awaken ? '觉醒技能' : S.passive ? '被动技能' : '主动技能';
  let s = `<div class="nm" style="color:#ffe070">${S.name}</div><div class="dim small">${kind}${S.type ? ' · ' + (SK_TYPE[S.type] || S.type) : ''}${S.elem ? ' · ' + (SK_ELEM[S.elem] || S.elem) + '属性' : ''} · Lv.${lv}/${max}</div><hr>`;
  if (!S.passive) s += `MP ${S.mp ?? 0} · 冷却 ${S.cd ?? 0} 秒<br>`;
  if (cmd) s += `<span class="gold">指令：${cmd}</span>${cmdLocked(id) ? ' <span style="color:#ff8a8a">（已锁定）</span>' : ''}<br>`;
  s += `<span class="small">${S.desc || ''}</span>`;
  if (detail) {
    const cur = skillInfo(id, lv), nxt = lv < max ? skillInfo(id, lv + 1) : [];
    if (cur.length) s += `<hr><span class="small dim">当前等级 Lv.${lv}</span><br>` + cur.map(([k, v]) => `${k} <b>${v}</b>`).join('<br>');
    if (lv < max) s += `<hr><span class="small dim">下一等级 Lv.${lv + 1}</span><br>` + (nxt.length ? nxt.map(([k, v]) => `${k} <b style="color:#8aff9a">${v}</b>`).join('<br>') + '<br>' : '') + `<span class="small">需要等级 ${skLvReq(S, lv + 1)} · SP ${skCost(S, lv)}</span>`;
    const pre = Object.entries(S.pre || {}); if (pre.length) s += `<hr><span class="small">前置技能：${pre.map(([p, l]) => `<span style="color:${(game.skillLv[p] || 0) >= l ? '#8aff9a' : '#ff8a8a'}">${SKILLS[p] ? SKILLS[p].name : p} Lv.${l}</span>`).join('、')}</span>`;
    s += `<hr><span class="small dim">${S.passive ? '' : '拖到技能栏使用 · '}${cmd ? '右键：锁定 / 解锁指令释放 · ' : ''}${keyName('tipDetail')} 切换简略说明</span>`;
  }
  return s;
}
Object.assign(menus, {
  w_skills() {
    if (!game.player) return null;
    const cls = game.player.cls, pages = skillPages(cls, game.job), C = CLASSES[cls] || {};
    let tab = this.skTab === 'job' ? 'job' : 'base';
    const ids = [...pages[tab]].sort((a, b) => (SKILLS[a].lvReq || 1) - (SKILLS[b].lvReq || 1));   // 官方：按学习等级排列
    let sel = this.skSel && (ids.includes(this.skSel)) ? this.skSel : ids[0];
    const rf = () => this.refresh('skills');
    const jobName = game.job && C.jobs && C.jobs[game.job] ? C.jobs[game.job].name : game.job;
    const tabs = h('div', { class: 'sktabs' },
      h('div', { class: 'sktab' + (tab === 'base' ? ' on' : ''), onclick: () => { this.skTab = 'base'; sfx.click(); rf(); } }, '基础技能'),
      h('div', { class: 'sktab' + (tab === 'job' ? ' on' : ''), onclick: () => { this.skTab = 'job'; sfx.click(); rf(); } }, game.job ? `转职技能 · ${jobName}` : '转职技能'),
      h('span', { class: 'sp' }), h('b', { class: 'gold sksp' }, `SP ${fmtNum(game.sp || 0)}`));
    const icon = (id, size = 56) => {
      const S = SKILLS[id], lv = game.skillLv[id] || 0;
      const wrap = h('div', { class: 'skic' + (lv ? '' : ' unl'), 'data-id': id }, h('img', { src: skillIcon(id, size).toDataURL(), draggable: 'false' }));
      if (cmdLocked(id)) wrap.appendChild(h('span', { class: 'lock', title: '指令已锁定' }, '锁'));
      if (S.passive) wrap.appendChild(h('span', { class: 'pas' }, '被动'));
      this.tipOn(wrap, () => skillTipHtml(id));
      if (typeof dnd !== 'undefined') dnd.source(wrap, () => {
        if (S.passive) { toastMsg('被动技能不用放进技能栏', '#ffd0a0'); return null; }
        if (!(game.skillLv[id] > 0)) { toastMsg('先学习这个技能，才能放进技能栏', '#ffd0a0'); return null; }
        return { type: 'skill', id, from: 'skills' };
      });
      wrap.addEventListener('contextmenu', ev => { ev.preventDefault(); toggleCmdLock(id); rf(); });
      return wrap;
    };
    let list;
    if (!ids.length) {
      const js = C.jobs ? Object.values(C.jobs).map(J => J.name).join('、') : '';
      list = h('div', { class: 'skempty dim' }, tab === 'job' ? (game.job ? '这个转职还没有技能数据' : `Lv.15 后到城镇导师处转职（${js || '转职方向待开放'}），就能在这里学习转职技能。`) : '没有技能');
    } else list = h('div', { class: 'sklist2' }, ids.map(id => {
      const S = SKILLS[id], lv = game.skillLv[id] || 0, upWhy = skillUpBlock(id), dnWhy = skillDownBlock(id);
      const lock = S.job && S.job !== game.job || game.lvl < (S.lvReq || 1);
      return h('div', { class: 'ski2' + (id === sel ? ' sel' : '') + (lock ? ' lock' : ''), onclick: () => { if (this.skSel !== id) { this.skSel = id; sfx.click(); rf(); } } },
        icon(id),
        h('div', { class: 'd' }, h('b', {}, S.name), h('div', { class: 'small' }, `Lv.${lv}/${skillMaxLv(S)}`, lv < skillMaxLv(S) ? h('span', { class: 'dim' }, ` · 需 Lv.${skLvReq(S, lv + 1)}`) : null)),
        h('div', { class: 'pm' },
          h('button', { class: 'btn pmb' + (upWhy ? ' off' : ''), title: upWhy || `升级（SP ${skCost(S, lv)}）`, onclick: ev => { ev.stopPropagation(); this.skSel = id; if (skillUp(id)) rf(); } }, '+'),
          h('button', { class: 'btn pmb' + (dnWhy ? ' off' : ''), title: dnWhy || '降级（返还 SP）', onclick: ev => { ev.stopPropagation(); this.skSel = id; if (skillDown(id)) rf(); } }, '−')));
    }));
    // 详情
    const detail = h('div', { class: 'skdetail' });
    if (sel) {
      const S = SKILLS[sel], lv = game.skillLv[sel] || 0, upWhy = skillUpBlock(sel), cmd = skCmd(sel);
      const cur = skillInfo(sel, lv), nxt = lv < skillMaxLv(S) ? skillInfo(sel, lv + 1) : [];
      const kv = (arr, col) => arr.map(([k, v]) => h('div', { class: 'kv' }, h('span', {}, k), h('b', { style: col ? `color:${col}` : '' }, String(v))));
      detail.append(...[
        h('div', { class: 'row' }, icon(sel, 64), h('div', { class: 'col', style: 'gap:.1em' }, h('b', { class: 'sknm' }, S.name), h('span', { class: 'small dim' }, `${S.awaken ? '觉醒技能' : S.passive ? '被动技能' : '主动技能'}${S.type ? ' · ' + (SK_TYPE[S.type] || S.type) : ''} · Lv.${lv}/${skillMaxLv(S)}`))),
        h('div', { class: 'small', style: 'line-height:1.5' }, S.desc || ''),
        !S.passive ? h('div', { class: 'kv' }, h('span', {}, 'MP / 冷却'), h('b', {}, `${S.mp ?? 0} / ${S.cd ?? 0} 秒`)) : null,
        cmd ? h('div', { class: 'kv' }, h('span', {}, '指令'), h('b', { class: 'gold' }, cmd, cmdLocked(sel) ? h('span', { style: 'color:#ff8a8a' }, '（已锁定）') : null)) : null,
        Object.keys(S.pre || {}).length ? h('div', { class: 'kv' }, h('span', {}, '前置技能'), h('b', {}, Object.entries(S.pre).map(([p, l]) => `${SKILLS[p] ? SKILLS[p].name : p} Lv.${l}`).join('、'))) : null,
        cur.length ? h('div', { class: 'sksec' }, h('div', { class: 'small dim' }, `当前 Lv.${lv}`), kv(cur)) : null,
        lv < skillMaxLv(S) ? h('div', { class: 'sksec' }, h('div', { class: 'small dim' }, `下一级 Lv.${lv + 1} · 需要等级 ${skLvReq(S, lv + 1)} · SP ${skCost(S, lv)}`), kv(nxt, '#8aff9a')) : h('div', { class: 'small gold' }, '已达到最高等级'),
        h('div', { class: 'row', style: 'margin-top:auto' },
          h('button', { class: 'btn' + (upWhy ? ' off' : ''), onclick: () => { if (skillUp(sel)) rf(); } }, lv ? '升级' : '学习'),
          h('button', { class: 'btn' + (skillDownBlock(sel) ? ' off' : ''), onclick: () => { if (skillDown(sel)) rf(); } }, '降级'),
          cmd ? h('button', { class: 'btn', onclick: () => { toggleCmdLock(sel); rf(); } }, cmdLocked(sel) ? '解锁指令' : '锁定指令') : null),
        upWhy && upWhy !== '已满级' ? h('div', { class: 'small', style: 'color:#ff9a8a' }, upWhy) : null].filter(Boolean));
    }
    // 技能栏预览（可以拖进来、点键位设置、右键清空）
    const bar = h('div', { class: 'skbar' }, [0, 1, 2, 3, 4, 5, 12, 6, 7, 8, 9, 10, 11, 13].map(i => {   // 两排各 7 格：第 7 格是 s12 / s13
      const id = game.skillBar[i] || null, cell = h('div', { class: 'bs' + (id && id === sel ? ' on' : ''), 'data-slot': i }, id && SKILLS[id] ? h('img', { src: skillIcon(id, 48).toDataURL(), draggable: 'false' }) : null, h('span', { class: 'k' }, keyName('s' + i)));
      if (typeof dnd !== 'undefined') {
        dnd.target(cell, { accept: p => p.type === 'skill' && SKILLS[p.id] && !SKILLS[p.id].passive, drop: p => { skillBarPut(i, p.id, p.from === 'bar' ? p.slot : undefined); rf(); } });
        if (id) dnd.source(cell, () => ({ type: 'skill', id, from: 'bar', slot: i, onVoid: () => { skillBarClear(i); rf(); } }));
      }
      if (id && SKILLS[id]) this.tipOn(cell, () => skillTipHtml(id));
      cell.addEventListener('click', () => { if (cell._dndJustDropped) return; if (sel && game.skillLv[sel] > 0 && !SKILLS[sel].passive) { skillBarPut(i, sel); sfx.click(); rf(); } });
      cell.addEventListener('contextmenu', ev => { ev.preventDefault(); skillBarClear(i); sfx.click(); rf(); });
      return cell;
    }));
    const reset = () => this.ask({ title: '重置技能', text: '把所有技能降回初始等级，并返还全部 SP？', okText: '重置', danger: true, ok: () => { resetSkills(); rf(); } });
    const body = h('div', { class: 'col skwin' }, tabs,
      h('div', { class: 'row', style: 'align-items:stretch;gap:.8em' }, list, detail),
      h('div', { class: 'row small dim', style: 'justify-content:space-between' }, h('span', {}, '技能栏：拖入技能 / 选中技能后点格子；拖出或右键清空'), h('button', { class: 'btn', style: 'font-size:.9em;padding:.2em .8em', onclick: reset }, '重置技能')),
      bar);
    return this.win('技能', body, { w: 54 });
  },
});
function toggleCmdLock(id) {
  if (!save.data) return;
  if (!skCmd(id)) { toastMsg('这个技能没有指令，不需要锁定', '#ffd0a0'); return; }
  const L = (save.data.opts.cmdLock = save.data.opts.cmdLock || {});
  if (L[id]) delete L[id]; else L[id] = true;
  toastMsg(`${SKILLS[id].name}：${L[id] ? '指令已锁定（只能用技能栏释放）' : '指令已解锁'}`, '#bfe8ff'); sfx.click(); save.write();
}
function resetSkills() {
  const { base, job } = skillPages();
  let back = 0;
  for (const id of [...base, ...job]) { const S = SKILLS[id], lv = game.skillLv[id] || 0, m = skMin(id); for (let l = m; l < lv; l++) back += skCost(S, l); if (lv > m) game.skillLv[id] = m; }
  game.sp = (game.sp || 0) + back;
  game.skillBar = game.skillBar.map(id => id && game.skillLv[id] ? id : null);
  if (game.player && typeof recalcStats === 'function') recalcStats(game.player);
  save.write(); sfx.buff(); toastMsg(`技能已重置，返还 SP ${fmtNum(back)}`, '#8aff9a');
}
addStyle(`
.skwin{gap:.55em}
.win.compact{width:30em!important}.win.compact .skdetail{display:none}
.sktabs{display:flex;gap:.3em;align-items:flex-end;border-bottom:.1em solid #5a4a36}
.sktab{padding:.35em 1em;border:.1em solid #5a4a36;border-bottom:0;border-radius:.3em .3em 0 0;background:#1a1420;color:#b8a888;cursor:pointer;font-weight:800;font-size:.95em}
.sktab.on{background:linear-gradient(180deg,#5a4020,#2a1c10);color:#ffe8a8}
.sksp{font-size:1.1em;padding-bottom:.2em}
.sklist2{flex:1;display:grid;grid-template-columns:repeat(2,1fr);gap:.35em;max-height:23em;overflow:auto;align-content:start;padding-right:.2em}
.ski2{display:flex;gap:.45em;align-items:center;padding:.3em;border:.1em solid #3a3040;border-radius:.25em;background:#16121a;cursor:pointer}
.ski2:hover{border-color:#8a6a3a}.ski2.sel{border-color:#ffd23a;background:#2a2014}.ski2.lock .skic,.ski2.lock .d{opacity:.5}
.ski2 .d{flex:1;min-width:0;line-height:1.3}.ski2 .d b{color:#ffe8a8;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.skic{position:relative;width:2.9em;height:2.9em;flex:none;border:.1em solid #6a5436;border-radius:.2em;overflow:hidden;cursor:grab;touch-action:none}
.skic img{width:100%;height:100%;display:block}.skic.unl img{filter:grayscale(.85) brightness(.7)}
.skic .lock{position:absolute;right:0;top:0;font-size:.55em;padding:0 .2em;background:#a02020;color:#fff;font-weight:900}
.skic .pas{position:absolute;left:0;bottom:0;right:0;font-size:.5em;text-align:center;background:rgba(0,0,0,.7);color:#9fe0ff}
.pm{display:flex;flex-direction:column;gap:.15em}.pmb{padding:0 .5em;min-width:1.8em;font-size:1em;line-height:1.3}
.skdetail{width:19em;flex:none;display:flex;flex-direction:column;gap:.4em;padding:.5em .6em;border:.1em solid #3a3040;border-radius:.25em;background:#120e16;min-height:20em}
.skdetail .sknm{font-size:1.25em;color:#ffe070}
.skdetail .skic{width:3.4em;height:3.4em}
.kv{display:flex;justify-content:space-between;gap:.6em;font-size:.88em}.kv b{color:#ffe8a8;text-align:right}
.sksec{border-top:.08em solid #3a3040;padding-top:.3em;display:flex;flex-direction:column;gap:.15em}
.skempty{flex:1;padding:2em 1em;text-align:center;line-height:1.7}
.skbar{display:grid;grid-template-columns:repeat(7,3.1em);grid-auto-rows:3.1em;gap:.3em;justify-content:center;padding:.4em;border:.1em solid #3a3040;border-radius:.25em;background:#0e0b12}
.skbar .bs{position:relative;border:.1em solid #5a4a36;border-radius:.2em;background:#16121a;cursor:pointer;overflow:hidden;touch-action:none}
.skbar .bs img{width:100%;height:100%;display:block}.skbar .bs.on{border-color:#ffd23a}
.skbar .bs .k{position:absolute;left:.15em;top:0;font-size:.65em;font-weight:900;color:#fff;text-shadow:0 0 .2em #000,0 0 .2em #000}
`);
