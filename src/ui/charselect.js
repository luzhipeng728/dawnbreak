/* =====================================================================
   标题 → 角色选择 → 创建角色（官方式）
   - 角色选择：最多 MAX_CHARS 个角色位，显示立绘、名字、等级、职业 / 转职、所在位置；开始游戏 / 创建角色 / 改名 / 删除角色（输入角色名确认）
   - 创建角色：选职业（立绘、介绍、转职方向预览）→ 输入角色名（长度 / 字符 / 重名校验）→ 出生在 START_SCENE
   - 系统菜单“返回角色选择”：backToCharSelect() 保存并清场
   注意：选角界面上 save.data 保持为 null，避免关页面时 save.write() 把当前（空的）游戏状态写进某个角色
   ===================================================================== */
const NAME_RULE = { min: 2, max: 12 };   // 按显示宽度计：汉字算 2，字母数字算 1（官方：最多 6 个汉字 / 12 个字母）
const csNameWidth = s => [...s].reduce((n, ch) => n + (/[⺀-鿿豈-﫿＀-￯]/.test(ch) ? 2 : 1), 0);
function checkCharName(name, skip = -1) {
  if (!name) return '请输入角色名';
  if (!/^[一-鿿A-Za-z0-9]+$/.test(name)) return '只能使用汉字、英文字母和数字（不能有空格和符号）';
  const w = csNameWidth(name);
  if (w < NAME_RULE.min) return `角色名太短（至少 ${NAME_RULE.min} 个字符）`;
  if (w > NAME_RULE.max) return `角色名太长（最多 ${NAME_RULE.max} 个字符，汉字算 2 个）`;
  if (/^\d+$/.test(name)) return '角色名不能全是数字';
  if (/GM|管理员|官方|系统/i.test(name)) return '角色名包含不能使用的文字';
  if (save.chars.some((c, i) => i !== skip && (c.name || '').toLowerCase() === name.toLowerCase())) return '这个名字已经被其他角色使用了';
  return null;
}
function suggestName(cls) {
  const pre = ['晨曦', '破晓', '星辉', '白夜', '苍风', '赤焰', '银月', '流光', '小小', '软糖'], C = CLASSES[cls] || {};
  for (let k = 0; k < 40; k++) { const n = pick(pre) + (C.name || '勇士').slice(-2) + (k > 8 ? rndi(1, 99) : ''); if (!checkCharName(n)) return n; }
  return '勇士' + rndi(100, 999);
}
const csClassName = (cls, job) => { const C = CLASSES[cls] || {}; const J = job && C.jobs && C.jobs[job]; return J ? J.name : (C.name || cls); };
const csLocName = d => { const id = d.loc && d.loc.scene; const S = SCENES[id] || SCENES[typeof START_SCENE !== 'undefined' ? START_SCENE : ''] || {}; return S.name || '艾尔文防线'; };
const csFmtPlay = s => { s = Math.floor(s || 0); const hh = Math.floor(s / 3600), mm = Math.floor(s % 3600 / 60); return hh ? `${hh} 小时 ${mm} 分` : `${mm} 分钟`; };
// 职业立绘（手绘优先；没有就用模型画一帧站姿）
function csClassArt(cls, cl = 'cart', job) {
  const C = CLASSES[cls] || {}, J = job && C.jobs && C.jobs[job], im = (J && J.art && IMG[J.art]) || IMG[`class/${cls}`];   // 转职后优先用转职立绘
  if (im) return h('img', { class: cl, src: im.src, draggable: 'false' });
  const cv = h('canvas', { class: cl, width: 90, height: 130 });
  requestAnimationFrame(() => { try { const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; x.translate(45, 124); C.model().draw(x, (CLIPS[cls] || CLIPS.sword).idle.keys[0][1], 0, {}); } catch (e) { /* 模型未就绪 */ } });
  return cv;
}
// 角色位上的站姿：有外观组的 avatarCanvas 时按存档里的装备 / 时装画（官方选角界面显示角色当前的样子），否则用职业立绘
function csCharArt(d) {
  if (typeof avatarCanvas === 'function' && typeof lookFromEquip === 'function') {
    try { const cv = avatarCanvas(d.cls, lookFromEquip(d.cls, d.equip), 180, 240, 2); cv.className = 'cart avatar'; return cv; } catch (e) { /* 回退到立绘 */ }
  }
  return csClassArt(d.cls, 'cart', d.job);
}
Object.assign(menus, {
  /* ---------------- 标题 ---------------- */
  w_title() {
    save.data = null; save.loadAll();
    const n = save.chars.length;
    const go = () => { sfx.init(); sfx.click(); this.close('title'); this.open('charselect'); };
    const el = h('div', { id: 'title', 'data-block': '1' },
      h('div', { class: 'logo' }, '破晓地下城'), h('div', { class: 'sub' }, 'DAWNBREAK DUNGEON'),
      h('div', { class: 'col', style: 'margin-top:1.5em;align-items:center;gap:.7em' },
        h('button', { class: 'btn big titlego', onclick: go }, '进入游戏'),
        h('div', { class: 'small dim' }, n ? `已有 ${n} 个角色 · 上次：${save.chars[Math.max(0, save.cur)].name || ''} Lv.${save.chars[Math.max(0, save.cur)].lvl}` : '还没有角色，进入后创建你的第一个角色'),
        h('button', { class: 'btn', onclick: () => { sfx.click(); this.show('settings'); } }, '游戏设置')),
      h('div', { class: 'small dim', style: 'margin-top:2em;text-align:center;line-height:1.8' }, `方向键移动（双击跑） · ${keyName('attack')} 攻击 · ${keyName('jump')} 跳跃 · ${keyName('cmd')} 指令技能 · ${[0, 1, 2, 3, 4, 5].map(i => keyName('s' + i)).join('')} / ${[6, 7, 8, 9, 10, 11].map(i => keyName('s' + i)).join('')} 技能栏`, h('br'), '进度自动保存在本机浏览器'));
    el._onConfirm = go;
    return el;
  },
  /* ---------------- 角色选择 ---------------- */
  w_charselect() {
    save.data = null; save.loadAll();
    const chars = save.chars, full = chars.length >= MAX_CHARS;
    if (this.csSel === undefined || this.csSel >= chars.length) this.csSel = chars.length ? Math.max(0, Math.min(save.cur, chars.length - 1)) : -1;
    const sel = this.csSel, d = chars[sel];
    const start = i => {
      if (!chars[i] || this.csBusy) return;
      this.csBusy = true; sfx.click();
      save.select(i); save.apply(); this.close('charselect');
      Promise.resolve(startGame(save.data.cls)).finally(() => { this.csBusy = false; });
    };
    const slots = [];
    for (let i = 0; i < MAX_CHARS; i++) {
      const c = chars[i];
      if (!c) { slots.push(h('div', { class: 'cslot empty', onclick: () => { sfx.click(); this.close('charselect'); this.open('newgame'); } }, h('div', { class: 'plus' }, '+'), h('div', { class: 'small' }, '创建角色'))); continue; }
      const card = h('div', { class: 'cslot' + (i === sel ? ' sel' : ''), 'data-i': i, onclick: () => { if (this.csSel !== i) { this.csSel = i; sfx.click(); this.refresh('charselect'); } }, ondblclick: () => start(i) },
        h('div', { class: 'lv' }, `Lv.${c.lvl}`), csCharArt(c), h('div', { class: 'stage' }),
        h('div', { class: 'nm' }, c.name || csClassName(c.cls)), h('div', { class: 'job' }, csClassName(c.cls, c.job)));
      slots.push(card);
    }
    const info = d ? h('div', { class: 'csinfo' },
      h('div', { class: 'row' }, h('b', { class: 'big' }, d.name || csClassName(d.cls)), h('span', { class: 'gold' }, `Lv.${d.lvl}`), h('span', {}, csClassName(d.cls, d.job) + (d.job ? `（${CLASSES[d.cls].name}）` : ''))),
      h('div', { class: 'row small' }, h('span', {}, `所在位置：${csLocName(d)}`), h('span', {}, `金币：${fmtNum(d.gold || 0)} G`), h('span', {}, `疲劳：${d.fatigue}/${FATIGUE_MAX}`), h('span', {}, `游戏时间：${csFmtPlay(d.playTime)}`)))
      : h('div', { class: 'csinfo dim' }, chars.length ? '选择一个角色' : '还没有角色。点击空的角色位或“创建角色”，开始你的冒险吧！');
    const del = () => {
      if (!d) return; sfx.click();
      this.ask({ title: '删除角色', danger: true, okText: '删除',
        text: `确定要删除 <b class="gold">${escHtml(d.name)}</b>（Lv.${d.lvl} ${escHtml(csClassName(d.cls, d.job))}）吗？<br><span style="color:#ff9a8a">删除后无法恢复。</span>请输入角色名确认：`,
        input: { placeholder: d.name, max: 16, check: v => v === d.name ? null : '输入的角色名不一致' },
        ok: () => { save.remove(sel); save.data = null; this.csSel = Math.min(sel, save.chars.length - 1); toastMsg(`角色 ${d.name} 已删除`, '#ffb0a0'); this.refresh('charselect'); } });
    };
    const rename = () => {
      if (!d) return; sfx.click();
      this.ask({ title: '角色改名', okText: '改名',
        text: `给 <b class="gold">${escHtml(d.name)}</b>（Lv.${d.lvl} ${escHtml(csClassName(d.cls, d.job))}）起个新名字（${NAME_RULE.min}~${NAME_RULE.max} 个字符，汉字算 2 个）：`,
        input: { placeholder: d.name, max: 16, check: v => v === d.name ? '和现在的名字一样' : checkCharName(v, sel) },
        ok: v => { const old = d.name; d.name = v; save.persist(); toastMsg(`${old} 已改名为 ${v}`, '#8aff9a'); this.refresh('charselect'); } });
    };
    const el = h('div', { id: 'charsel', 'data-block': '1' },
      h('div', { class: 'cshd' }, h('div', { class: 'logo' }, '选择角色'), h('div', { class: 'small dim' }, `角色位 ${chars.length}/${MAX_CHARS}`)),
      h('div', { class: 'csrow' }, slots), info,
      h('div', { class: 'row csbtns' },
        h('button', { class: 'btn big' + (d ? '' : ' off'), onclick: () => start(sel) }, '开始游戏'),
        h('button', { class: 'btn big blue' + (full ? ' off' : ''), onclick: () => { sfx.click(); this.close('charselect'); this.open('newgame'); } }, '创建角色'),
        h('button', { class: 'btn' + (d ? '' : ' off'), onclick: rename }, '改名'),
        h('button', { class: 'btn red' + (d ? '' : ' off'), onclick: del }, '删除角色'),
        h('button', { class: 'btn', onclick: () => { sfx.click(); this.close('charselect'); this.open('title'); } }, '返回')),
      full ? h('div', { class: 'small dim' }, `角色位已满（最多 ${MAX_CHARS} 个），删除角色后才能创建新角色`) : null);
    el._onConfirm = () => start(sel);
    // 键盘：←→ 切换角色
    el._key = e => { if (!chars.length) return; const k = e.code === 'ArrowLeft' ? -1 : e.code === 'ArrowRight' ? 1 : 0; if (k) { this.csSel = (Math.max(0, sel) + k + chars.length) % chars.length; sfx.click(); this.refresh('charselect'); } };
    return el;
  },
  /* ---------------- 创建角色 ---------------- */
  w_newgame() {
    save.data = null; save.loadAll();
    const ids = Object.keys(CLASSES).filter(id => CLASSES[id].name);
    if (!this.ngCls || !CLASSES[this.ngCls] || CLASSES[this.ngCls].ready === false) this.ngCls = ids.find(id => CLASSES[id].ready !== false) || ids[0];
    const cls = this.ngCls, C = CLASSES[cls];
    const list = h('div', { class: 'nglist' }, ids.map(id => {
      const K = CLASSES[id], off = K.ready === false;
      return h('div', { class: 'clscard' + (id === cls ? ' sel' : '') + (off ? ' off' : ''), 'data-cls': id, onclick: () => { if (off) return; if (this.ngCls !== id) { if (!this.ngTyped) this.ngName = null; this.ngCls = id; sfx.click(); this.refresh('newgame'); } } },
        csClassArt(id, 'clsart'), h('h3', {}, K.name), off ? h('p', { class: 'gold' }, '即将开放') : null);
    }));
    const jobs = C.jobs ? Object.entries(C.jobs) : [];
    const jobsEl = jobs.length ? h('div', { class: 'ngjobs' }, jobs.map(([jid, J]) => h('div', { class: 'ngjob' },
      J.art && IMG[J.art] ? h('img', { src: IMG[J.art].src }) : null,
      h('b', {}, J.name), J.role ? h('span', { class: 'small gold' }, ` · ${J.role}`) : null, h('div', { class: 'small' }, J.desc || ''),
      J.awakenName ? h('div', { class: 'small dim' }, `觉醒：${J.awakenName}`) : null)))
      : h('div', { class: 'small dim' }, '达到 Lv.15 后可以在城镇导师处转职，选择自己的发展方向。');
    // 创建时就能选的转职（官方：协战师在创建角色时直接选）：默认按基础职业开局
    const pre = jobs.filter(([, J]) => J.atCreate);
    if (this.ngJob && !pre.some(([jid]) => jid === this.ngJob)) this.ngJob = null;
    const preEl = pre.length ? h('div', { class: 'row', style: 'gap:.4em;flex-wrap:wrap;margin-top:.3em' },
      h('span', { class: 'small gold' }, '开局职业'),
      ...[[null, C.name + '（Lv.15 再转职）'], ...pre.map(([jid, J]) => [jid, J.name + '（直接开局）'])].map(([jid, label]) =>
        h('button', { class: 'btn sm' + ((this.ngJob || null) === jid ? '' : ' blue'), onclick: () => { this.ngJob = jid; sfx.click(); this.refresh('newgame'); } }, label))) : null;
    const skills = (C.skills || []).filter(id => SKILLS[id] && !SKILLS[id].job).slice(0, 6);
    const field = h('input', { class: 'txt', type: 'text', maxlength: 12, placeholder: '输入角色名', autocomplete: 'off', spellcheck: 'false' });
    field.value = this.ngName || suggestName(cls);
    const err = h('div', { class: 'ngerr' });
    const full = save.chars.length >= MAX_CHARS;
    const check = () => { const m = full ? `角色位已满（最多 ${MAX_CHARS} 个角色）` : checkCharName(field.value.trim()); err.textContent = m || '✓ 可以使用'; err.classList.toggle('ok', !m); return m; };
    const create = () => {
      if (this.ngBusy) return;
      const m = check(); if (m) { sfx.error(); field.focus(); return; }
      this.ngBusy = true; sfx.click(); field.blur();
      const name = field.value.trim(); this.ngName = null; this.ngTyped = false;
      this.close('newgame'); save.newGame(cls, name); this.csSel = save.cur;
      const pj = this.ngJob && C.jobs && C.jobs[this.ngJob] && C.jobs[this.ngJob].atCreate ? this.ngJob : null; this.ngJob = null;
      if (pj) { save.data.job = pj; game.job = pj; }
      Promise.resolve(startGame(cls)).finally(() => { this.ngBusy = false; });
    };
    field.addEventListener('input', () => { this.ngName = field.value; this.ngTyped = true; check(); });
    field.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); create(); } else if (e.key === 'Escape') { e.preventDefault(); field.blur(); } });
    const el = h('div', { id: 'newgame', 'data-block': '1' },
      h('div', { class: 'logo' }, '创建角色'),
      h('div', { class: 'ngbody' },
        list,
        h('div', { class: 'ngart' }, csClassArt(cls, 'bigart')),
        h('div', { class: 'ngdesc' },
          h('div', { class: 'ngname' }, C.name), h('div', { class: 'ngtxt' }, C.desc || ''),
          skills.length ? h('div', { class: 'ngskills' }, h('div', { class: 'small gold' }, '初始技能'), h('div', { class: 'row', style: 'flex-wrap:wrap;gap:.3em' }, skills.map(id => this.tipOn(h('img', { class: 'ngsk', src: skillIcon(id, 48).toDataURL() }), () => `<b>${SKILLS[id].name}</b><br><span class="small">${SKILLS[id].desc || ''}</span>`)))) : null,
          h('div', { class: 'small gold', style: 'margin-top:.5em' }, '转职方向（Lv.15）'), jobsEl, preEl,
          h('div', { class: 'ngform' }, h('div', { class: 'small' }, `角色名（${NAME_RULE.min}~${NAME_RULE.max} 个字符，汉字算 2 个）`), h('div', { class: 'row' }, field, h('button', { class: 'btn', title: '随机名字', onclick: () => { field.value = suggestName(cls); this.ngName = field.value; this.ngTyped = false; check(); sfx.click(); } }, '随机')), err))),
      h('div', { class: 'row csbtns' },
        h('button', { class: 'btn big' + (full ? ' off' : ''), onclick: create }, '创建并开始'),
        h('button', { class: 'btn', onclick: () => { sfx.click(); this.close('newgame'); this.open('charselect'); } }, '返回')));
    el._onConfirm = create;
    check();
    return el;
  },
});
// 选角界面的方向键
addEventListener('keydown', e => { if (e.repeat || isTyping()) return; const el = menus.wins[menus.top()]; if (el && el._key) el._key(e); });
/* ---- 返回角色选择：保存当前角色 → 清场（实体 / 特效 / 掉落 / 窗口 / 地下城）→ 回到选角界面 ---- */
function backToCharSelect() {
  if (game.scene === 'dungeon') { toastMsg('地下城里不能切换角色，请先返回城镇', '#ffd0a0'); sfx.error(); return false; }
  if (save.data) save.write();
  bus.emit('charLeave', { cls: game.player && game.player.cls });
  menus.closeAll();
  ents.length = 0; projs.length = 0; drops.length = 0; fxList.length = 0; numList.length = 0; groundFx.length = 0;
  game.player = null; game.dungeon = null; game.paused = false; game.cutin = null; game.slowmo = false; game.timeStop = 0; game.timers.length = 0;
  game.combo = 0; game.comboT = 0; game.maxCombo = 0; game.lastTarget = null; game.job = null;
  world = null; inv.potCd = 0; input.clearAll(); ui.log.length = 0;
  menus.sel = null; menus.skSel = null; menus.enSel = null;
  save.data = null; save.live = false;
  game.scene = 'title'; game.room = { x0: 0, x1: 1600, theme: 'forest', seed: 3 }; if (!IMG.title) buildRoomArt(game.room); cam.x = 200; cam.shake = 0;
  menus.open('charselect'); music.play('title');
  return true;
}
addStyle(`
#title .titlego{font-size:1.6em;padding:.6em 3em}
#charsel,#newgame{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1em;background:radial-gradient(ellipse at 50% 45%,rgba(10,6,16,.35),rgba(6,4,10,.88))}
#charsel .logo,#newgame .logo{font-size:3em;font-weight:900;letter-spacing:.1em;background:linear-gradient(180deg,#fff8d8,#ffd23a 50%,#c86a1a);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 .06em 0 #3a1400)}
.cshd{display:flex;flex-direction:column;align-items:center;gap:.2em}.cshd .small{color:#e8dcc0;text-shadow:0 0 .3em #000,0 0 .3em #000}
#charsel{font-size:1.15em}body.touchui #charsel{font-size:1em}
.csrow{display:flex;gap:.8em;align-items:flex-end;flex-wrap:wrap;justify-content:center;max-width:96%}
.cslot{position:relative;width:10.5em;height:17em;border:.12em solid #5a4a36;border-radius:.5em;background:linear-gradient(180deg,rgba(40,30,44,.85),rgba(14,10,18,.92));cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding:.5em .3em;transition:transform .15s,border-color .15s,box-shadow .15s}
.cslot:hover{border-color:#b8945a;transform:translateY(-.2em)}
.cslot.sel{border-color:#ffd23a;box-shadow:0 0 1.2em rgba(255,210,58,.45),inset 0 0 2em rgba(255,210,58,.12);transform:translateY(-.4em)}
.cslot .cart{width:9em;height:12em;object-fit:contain;object-position:bottom;position:relative;z-index:1;filter:drop-shadow(0 .3em .4em rgba(0,0,0,.6))}
.cslot.sel .cart{animation:csbob 1.6s ease-in-out infinite}
@keyframes csbob{0%,100%{transform:translateY(0)}50%{transform:translateY(-.25em)}}
.cslot .stage{position:absolute;left:12%;right:12%;bottom:3.6em;height:1.4em;border-radius:50%;background:radial-gradient(ellipse,rgba(255,220,140,.35),rgba(0,0,0,0) 70%)}
.cslot.sel .stage{background:radial-gradient(ellipse,rgba(255,220,100,.75),rgba(0,0,0,0) 70%)}
.cslot .nm{font-weight:900;color:#ffe8a8;font-size:1.05em;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cslot .job{font-size:.8em;color:#9fe0ff}
.cslot .lv{position:absolute;left:.5em;top:.4em;font-weight:900;color:#ffd23a;font-size:.95em;text-shadow:0 0 .3em #000;z-index:2}
.cslot.empty{justify-content:center;border-style:dashed;color:#8a7a60;opacity:.75}
.cslot.empty .plus{font-size:3em;line-height:1;font-weight:300}
.csinfo{min-width:40em;min-height:3.8em;padding:.6em 1.2em;border:.1em solid #5a4a36;border-radius:.4em;background:rgba(14,10,18,.85);display:flex;flex-direction:column;gap:.35em;align-items:center;justify-content:center}
.csinfo .big{font-size:1.4em;color:#ffe8a8}.csinfo .row{gap:1.2em}
.csbtns{gap:.8em}
.nglist{display:flex;flex-direction:column;gap:.6em}
#newgame .clscard{width:9em;padding:.4em;display:flex;align-items:center;gap:.4em;text-align:left}
#newgame .clscard .clsart{width:3.4em;height:4.4em;margin:0}
#newgame .clscard h3{font-size:1.15em}
#newgame .clscard.sel{border-color:#ffd23a;box-shadow:0 0 .8em rgba(255,210,58,.4);background:linear-gradient(180deg,rgba(70,52,30,.95),rgba(26,18,12,.95))}
.ngbody{display:flex;gap:1.4em;align-items:stretch}
.ngart{width:18em;height:26em;display:flex;align-items:flex-end;justify-content:center;background:radial-gradient(ellipse at 50% 85%,rgba(255,210,120,.25),rgba(0,0,0,0) 60%)}
.ngart .bigart{max-width:100%;max-height:100%;object-fit:contain;filter:drop-shadow(0 .5em 1em rgba(0,0,0,.6));animation:csbob 2s ease-in-out infinite}
.ngdesc{width:26em;padding:.8em 1em;border:.12em solid #6a5436;border-radius:.4em;background:linear-gradient(180deg,rgba(30,24,34,.95),rgba(14,11,18,.95));display:flex;flex-direction:column;gap:.35em}
.ngname{font-size:1.8em;font-weight:900;color:#ffe070}
.ngtxt{line-height:1.6;color:#e9e2d0}
.ngsk{width:2.4em;height:2.4em;border:.08em solid #5a4a36;border-radius:.2em}
.ngjobs{display:flex;flex-direction:column;gap:.3em;max-height:9em;overflow:auto}
.ngjob{padding:.3em .5em;border:.08em solid #3a3040;border-radius:.25em;background:#16121a;line-height:1.4}.ngjob b{color:#ffe8a8}.ngjob img{float:right;width:2.6em;height:2.6em;object-fit:contain}
.ngform{margin-top:auto;display:flex;flex-direction:column;gap:.3em;padding-top:.5em;border-top:.08em solid #3a3040}
input.txt{font:inherit;font-size:1.1em;padding:.35em .6em;border:.1em solid #8a6a3a;border-radius:.25em;background:#0c0a10;color:#fff2d0;outline:none;min-width:0;flex:1;user-select:text;-webkit-user-select:text}
input.txt:focus{border-color:#ffd23a;box-shadow:0 0 .4em rgba(255,210,58,.4)}
.ngerr{font-size:.85em;min-height:1.3em;color:#ff9a8a}.ngerr.ok{color:#8aff9a}
`);
