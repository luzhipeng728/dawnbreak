/* =====================================================================
   游戏设置 O（官方式分页）：声音 / 画面 / 按键设置 / 手机按钮
   - 全部存在本机（localStorage dawnbreak_ui_v1，见 core.js 的 prefs），与角色无关
   - 按键设置：点按键格 → 按下新键；同一个键只能属于一个动作（官方规则，被占用的动作会失去这个键）；可恢复默认
   - 窗口名 keyconfig = 直接打开“按键设置”页
   ===================================================================== */
Object.assign(menus, {
  w_keyconfig() { this.setTab = 'keys'; return this.w_settings(); },
  w_settings(arg) {
    if (arg && arg.tab) this.setTab = arg.tab;
    const tab = this.setTab || 'sound', rf = () => this.refresh(this.isOpen('settings') ? 'settings' : 'keyconfig');
    const tabs = h('div', { class: 'sktabs' }, [['sound', '声音'], ['video', '画面'], ['keys', '按键设置'], ['touch', '手机按钮']].map(([id, t]) =>
      h('div', { class: 'sktab' + (tab === id ? ' on' : ''), 'data-tab': id, onclick: () => { this.setTab = id; this.capturing = null; sfx.click(); rf(); } }, t)));
    const slider = (label, k, min, max, step, fmt, after) => {
      const val = h('b', { class: 'sv' }, fmt(uiPref(k)));
      return h('label', { class: 'setrow' }, h('span', {}, label), h('input', { type: 'range', min, max, step, value: uiPref(k), 'data-pref': k, oninput: e => { setPref(k, +e.target.value); val.textContent = fmt(+e.target.value); if (after) after(); } }), val);
    };
    const toggle = (label, k, hint, invert) => {
      const on = invert ? !uiPref(k) : !!uiPref(k);
      return h('div', { class: 'setrow' }, h('span', {}, label, hint ? h('span', { class: 'small dim' }, `  ${hint}`) : null),
        h('div', { class: 'tog' + (on ? ' on' : ''), 'data-pref': k, onclick: () => { setPref(k, !uiPref(k)); if (k.startsWith('touch') && touch.applyPrefs) touch.applyPrefs(); sfx.click(); rf(); } }, h('i')));
    };
    const pct = v => Math.round(v * 100) + '%';
    let page;
    if (tab === 'sound') page = h('div', { class: 'col' },
      slider('音乐音量', 'music', 0, 1, 0.05, pct, applyVolumes), slider('音效音量', 'sfx', 0, 1, 0.05, pct, () => { applyVolumes(); sfx.click(); }),
      sfx.muted ? h('div', { class: 'small dim' }, '当前以 ?mute 参数启动，声音已静音') : null);
    else if (tab === 'video') page = h('div', { class: 'col' },
      toggle('伤害数字', 'dmgNum', '打中敌人时弹出的数字'),
      toggle('屏幕震动', 'shake', '重击、爆炸时的镜头震动'),
      toggle('技能插图特效', 'cutin', '觉醒技能的角色插图'),
      toggle('掉落物名称', 'dropNames', `快捷键 ${keyName('dropNames')}`),
      toggle('实时评价', 'hideRank', `右下角的操作 / 技巧评价，快捷键 ${keyName('hideRank')}`, true),
      toggle('详细说明', 'tipDetail', `技能 / 装备提示框显示详细数值，快捷键 ${keyName('tipDetail')}`),
      h('div', { class: 'setrow' }, h('span', {}, '界面显示', h('span', { class: 'small dim' }, `  快捷键 ${keyName('uiMode')}`)),
        h('div', { class: 'row seg' }, [['full', '完整'], ['lite', '简洁']].map(([v, t]) => h('button', { class: 'btn' + (uiPref('hudMode') === v ? ' on' : ''), 'data-hud': v, onclick: () => { setPref('hudMode', v); sfx.click(); rf(); } }, t)))),
      h('div', { class: 'row', style: 'margin-top:.4em' },
        h('button', { class: 'btn', onclick: () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {}); } }, '全屏切换'),
        h('button', { class: 'btn', onclick: () => { setPref('winPos', {}); toastMsg('窗口位置已重置（下次打开生效）', '#bfe8ff'); sfx.click(); } }, '重置窗口位置')));
    else if (tab === 'keys') page = this.keyPage(rf);
    else page = h('div', { class: 'col' },
      h('div', { class: 'small dim' }, touch.on ? '调整屏幕上的虚拟摇杆和按键（关闭设置后即可看到效果）' : '当前不是触屏设备；在手机 / 平板上打开游戏会自动显示虚拟按键（电脑上可以加 ?touch 参数预览）'),
      slider('按钮大小', 'touchSize', 0.7, 1.4, 0.05, pct, () => touch.applyPrefs && touch.applyPrefs()),
      slider('按钮不透明度', 'touchAlpha', 0.3, 1, 0.05, pct, () => touch.applyPrefs && touch.applyPrefs()),
      toggle('左右互换', 'touchSwap', '摇杆放右边、按键放左边（左撇子）'),
      h('button', { class: 'btn', style: 'align-self:flex-start', onclick: () => { setPref('touchSize', 1); setPref('touchAlpha', 1); setPref('touchSwap', false); if (touch.applyPrefs) touch.applyPrefs(); sfx.click(); rf(); } }, '恢复默认布局'));
    const body = h('div', { class: 'col setwin' }, tabs, h('div', { class: 'setpage' }, page));
    return this.win('游戏设置', body, { w: tab === 'keys' ? 50 : 34 });
  },
  // 按键设置页
  keyPage(rf) {
    const cap = this.capturing;
    const cell = (a, slot) => {
      const code = KEYMAP[a][slot], on = cap && cap.a === a && cap.slot === slot, fixed = KEY_FIXED.has(a);
      return h('div', { class: 'kcell' + (on ? ' wait' : '') + (code ? '' : ' none') + (fixed ? ' fixed' : ''), 'data-act': a, 'data-slot': slot,
        onclick: ev => { ev.stopPropagation(); if (fixed) { toastMsg('这个按键不能修改', '#ffd0a0'); return; } this.capturing = on ? null : { a, slot: Math.min(slot, KEYMAP[a].length) }; sfx.click(); rf(); },
        oncontextmenu: ev => { ev.preventDefault(); if (fixed || !code) return; unbindKey(a, slot); sfx.click(); rf(); } },
        on ? '请按键…' : code ? keyLabel(code) : '—');
    };
    const groups = [...KEY_GROUPS.map(([g, acts]) => [g, acts]), ['系统', ['menu']]];
    const missing = Object.keys(KEYMAP_DEFAULT).filter(a => !KEYMAP[a].length && !['cmdB', 'pvp', 'tipDetail', 'shot', 'hideRank', 'uiMode', 'dropNames'].includes(a));
    return h('div', { class: 'col' },
      h('div', { class: 'small dim' }, '点击按键格后按下新的键（Esc 取消）；右键清除。同一个键只能分配给一个动作，重复分配时旧的会被清除。'),
      missing.length ? h('div', { class: 'small', style: 'color:#ff9a8a' }, `以下动作没有按键：${missing.map(a => ACTION_NAME[a]).join('、')}`) : null,
      h('div', { class: 'keygrid' }, groups.map(([g, acts]) => h('div', { class: 'kgroup' }, h('div', { class: 'kgt' }, g),
        acts.map(a => h('div', { class: 'krow' }, h('span', { class: 'kn' }, ACTION_NAME[a] || a), cell(a, 0), cell(a, 1)))))),
      h('div', { class: 'row', style: 'justify-content:flex-end' },
        h('button', { class: 'btn red', onclick: () => this.ask({ title: '恢复默认按键', text: '所有按键恢复为默认设置？', okText: '恢复默认', ok: () => { resetKeys(); this.capturing = null; toastMsg('按键已恢复默认', '#bfe8ff'); rf(); } }) }, '恢复默认')));
  },
});
// 改键：捕获阶段拦截下一次按键，不让它传给游戏
addEventListener('keydown', e => {
  const cap = menus.capturing; if (!cap) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const rf = () => menus.refresh(menus.isOpen('settings') ? 'settings' : 'keyconfig');
  if (e.code === 'Escape') { menus.capturing = null; rf(); return; }
  if (KEY_BANNED.has(e.code)) { toastMsg(`${keyLabel(e.code)} 不能用作游戏按键`, '#ff9a8a'); sfx.error(); return; }
  const lost = bindKey(cap.a, e.code, cap.slot);
  menus.capturing = null;
  if (lost === null) { toastMsg('这个键不能修改', '#ff9a8a'); sfx.error(); }
  else { sfx.click(); if (lost.length) toastMsg(`${keyLabel(e.code)} 原来是「${lost.map(a => ACTION_NAME[a] || a).join('、')}」，已改给「${ACTION_NAME[cap.a]}」`, '#ffd23a'); }
  rf();
}, true);
addEventListener('pointerdown', e => { if (menus.capturing && !e.target.closest('.kcell')) { menus.capturing = null; menus.refresh(menus.isOpen('settings') ? 'settings' : 'keyconfig'); } }, true);
addStyle(`
.setwin{gap:.6em}.setpage{min-height:16em}
.setrow{display:flex;align-items:center;gap:.8em;justify-content:space-between;padding:.35em .2em;border-bottom:.06em solid #2a2230}
.setrow input[type=range]{flex:1;accent-color:#e8c26a;min-width:6em}.setrow .sv{width:3.2em;text-align:right;color:#ffe8a8}
.tog{width:2.8em;height:1.4em;border-radius:.7em;background:#3a3040;position:relative;cursor:pointer;flex:none;transition:background .15s}
.tog i{position:absolute;left:.15em;top:.15em;width:1.1em;height:1.1em;border-radius:50%;background:#bbb;transition:left .15s}
.tog.on{background:#8a6a24}.tog.on i{left:1.55em;background:#ffe8a8}
.seg{gap:0}.seg .btn{border-radius:0;opacity:.5}.seg .btn:first-child{border-radius:.25em 0 0 .25em}.seg .btn:last-child{border-radius:0 .25em .25em 0}.seg .btn.on{opacity:1;border-color:#ffd23a;color:#fff}
.keygrid{display:grid;grid-template-columns:repeat(2,1fr);gap:.4em 1em;max-height:24em;overflow:auto;padding-right:.3em}
.kgroup{display:flex;flex-direction:column;gap:.15em}.kgt{color:#e8c26a;font-weight:900;font-size:.9em;border-bottom:.06em solid #5a4a36;margin-top:.2em}
.krow{display:grid;grid-template-columns:1fr 5.4em 5.4em;gap:.3em;align-items:center;font-size:.85em}
.kcell{text-align:center;padding:.15em .2em;border:.1em solid #5a4a36;border-radius:.2em;background:#1e1810;cursor:pointer;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.kcell:hover{border-color:#e8c26a}.kcell.none{color:#6a5a4a}.kcell.fixed{opacity:.55;cursor:default}
.kcell.wait{background:#6a4a24;color:#fff;border-color:#ffd23a;animation:kblink .8s infinite}
@keyframes kblink{50%{background:#3a2610}}
`);
