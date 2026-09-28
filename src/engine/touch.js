/* =====================================================================
   32. 触屏操作（手机 / 平板自动启用，?touch 强制启用）
   左半屏：浮动摇杆（推到底 = 跑步；方向变化会记入指令输入）；右侧：攻击 X / 跳跃 C / 指令 Z / 指令 2（Space）/ 后跳（↓+C）/ 7 个技能（翻页切换两排）；
   左上：药水 / 翻页 / 物品栏 / 技能 / 任务 / 菜单。设置 → 手机按钮 可以调大小、透明度、左右互换（uiPref touchSize / touchAlpha / touchSwap）
   打开任何窗口时隐藏虚拟按键，避免和窗口抢触摸（窗口用 ✕ 关闭）
   ===================================================================== */
const touch = {
  on: (IS_TOUCH || PARAMS.has('touch')) && !PARAMS.has('bot'), stick: null, dirs: {}, page: 0, skillEls: [], barSig: '', placed: [],
  init() {
    if (!this.on) return;
    document.body.classList.add('touchui');
    const el = h('div', { id: 'touch' });
    const zone = h('div', { class: 'tzone' }), base = h('div', { class: 'tbase hidden' }), knob = h('div', { class: 'tknob' });
    base.appendChild(knob); zone.appendChild(base);
    const R = () => stage.clientHeight * 0.09 * uiPref('touchSize');
    zone.addEventListener('pointerdown', ev => {
      ev.preventDefault(); sfx.init(); if (this.stick) return;   // 摇杆区域只认第一根手指
      zone.setPointerCapture(ev.pointerId);
      const r = zone.getBoundingClientRect();
      this.stick = { id: ev.pointerId, x0: ev.clientX, y0: ev.clientY, dx: 0, dy: 0 };
      base.style.left = (ev.clientX - r.left) + 'px'; base.style.top = (ev.clientY - r.top) + 'px'; base.classList.remove('hidden'); knob.style.transform = '';
    });
    zone.addEventListener('pointermove', ev => {
      const s = this.stick; if (!s || ev.pointerId !== s.id) return;
      let dx = ev.clientX - s.x0, dy = ev.clientY - s.y0; const l = Math.hypot(dx, dy), m = R();
      if (l > m) { dx *= m / l; dy *= m / l; }
      s.dx = dx / m; s.dy = dy / m; s.raw = l / m; knob.style.transform = `translate(${dx}px,${dy}px)`;
    });
    const end = ev => { if (this.stick && ev.pointerId === this.stick.id) { this.stick = null; base.classList.add('hidden'); } };
    zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);
    const btn = (label, cls, down, up) => {
      const b = h('div', { class: 'tbtn ' + cls }, label);
      b.addEventListener('pointerdown', ev => { ev.preventDefault(); ev.stopPropagation(); sfx.init(); b.setPointerCapture(ev.pointerId); b.classList.add('on'); down(); });
      const u = () => { b.classList.remove('on'); if (up) up(); };
      b.addEventListener('pointerup', u); b.addEventListener('pointercancel', u);
      return b;
    };
    const key = (a) => [() => { input.virt[a] = 2; }, () => { delete input.virt[a]; }];
    // 右下角：X 为圆心，C / Z / 后跳在内圈，7 个技能在外圈（角度 / 半径 / 大小，单位 vh，相对屏幕右下角）
    const put = (b, ang, r, size) => { this.placed.push({ b, ang, r, size }); el.appendChild(b); return b; };
    put(btn('X', 'atk', ...key('attack')), 0, 0, 16); put(btn('C', 'jump', ...key('jump')), 196, 16.5, 10.5); put(btn('Z', 'cmd', ...key('cmd')), 104, 16.5, 10.5);
    // 后跳（等同 ↓+C：技能中 / 受击中要学后跳-强化）
    put(btn('后跳', 'dodge', () => { input.virt.down = input.virt.down || 1; input.virt.jump = 2; this.bsDown = true; }, () => { delete input.virt.jump; if (this.bsDown && !this.dirs.down) delete input.virt.down; this.bsDown = false; }), 150, 17, 10.5);
    // 指令键 2（等同键盘 Space：方向 + Space 放 Buff 类技能）
    put(btn('Space', 'cmdb', ...key('cmdB')), 64, 17, 8);
    // 技能按钮：第 1 页 = 第 1 排（s0..s5 + s12），第 2 页 = 第 2 排（s6..s11 + s13）
    const slotOf = i => i < 6 ? i + this.page * 6 : 12 + this.page;
    [212, 186, 160, 134, 108, 82, 56].forEach((ang, i) => { const b = put(btn('', 'sk', () => { b._slot = slotOf(i); input.virt['s' + b._slot] = 2; }, () => { if (b._slot !== undefined) delete input.virt['s' + b._slot]; }), ang, 29, 9); this.skillEls.push(b); });
    this.slotOf = slotOf;
    const misc = h('div', { class: 'tmisc' },
      btn('HP', 'pot hp', ...key('i0')), btn('MP', 'pot mp', ...key('i1')),
      btn('⇅', '', () => { this.page ^= 1; this.barSig = ''; }), btn('包', '', () => uiKey('inv')), btn('技', '', () => uiKey('skills')), btn('任', '', () => uiKey('quests')), btn('≡', '', () => uiKey('menu')));
    el.prepend(zone); el.appendChild(misc);
    el.addEventListener('contextmenu', ev => ev.preventDefault());
    document.body.appendChild(el); this.el = el; this.zone = zone; this.misc = misc;
    document.body.appendChild(h('div', { id: 'rotate' }, '请把手机横过来玩 ↻'));
    this.applyPrefs();
  },
  // 按设置摆放按钮：大小倍率、透明度、左右互换
  applyPrefs() {
    if (!this.el) return;
    const k = uiPref('touchSize'), swap = !!uiPref('touchSwap'), CX = 13 * k, CY = 25 * k;
    for (const { b, ang, r, size } of this.placed) {
      const a = ang * Math.PI / 180, dx = Math.cos(a) * r * k, dy = Math.sin(a) * r * k, s = size * k;
      Object.assign(b.style, { width: s + 'vh', height: s + 'vh', bottom: (CY + dy - s / 2) + 'vh', fontSize: (3.4 * k) + 'vh', left: '', right: '' });
      b.style[swap ? 'left' : 'right'] = (CX - dx - s / 2) + 'vh';
      if (b.classList.contains('atk')) b.style.fontSize = (6 * k) + 'vh';
      if (b.classList.contains('cmdb')) b.style.fontSize = (2.4 * k) + 'vh';
    }
    this.el.style.opacity = uiPref('touchAlpha');
    this.zone.classList.toggle('swap', swap); this.misc.classList.toggle('swap', swap);
  },
  // 每个逻辑帧开始时：摇杆 → 虚拟方向键（新按下的方向记为“按下沿”，这样 ↓→+Z 之类的指令也能搓出来）
  tick() {
    if (!this.el) return;
    const hide = game.scene === 'title' || !game.player || menus.stack.length > 0;
    this.el.classList.toggle('hidden', hide);
    if (hide && this.stick) { this.stick = null; this.el.querySelector('.tbase').classList.add('hidden'); }
    const s = this.stick, want = {};
    if (s) { if (s.dx > 0.38) want.right = 1; if (s.dx < -0.38) want.left = 1; if (s.dy > 0.45) want.down = 1; if (s.dy < -0.45) want.up = 1; }
    for (const d of ['left', 'right', 'up', 'down']) {
      if (want[d]) { input.virt[d] = this.dirs[d] ? (input.virt[d] || 1) : 2; this.dirs[d] = 1; }
      else if (this.dirs[d]) { delete input.virt[d]; this.dirs[d] = 0; }
    }
    if (s) input.runDir = s.raw > 1.5 && Math.abs(s.dx) > 0.8 ? Math.sign(s.dx) : 0;   // 手指拖出摇杆圈外 = 跑
    else if (this.hadStick) input.runDir = 0;
    this.hadStick = !!s;
    // 技能按钮图标跟着技能栏走
    const sig = this.page + ':' + game.skillBar.join(',');
    if (sig !== this.barSig) {
      this.barSig = sig;
      this.skillEls.forEach((b, i) => { const id = game.skillBar[this.slotOf(i)]; b.style.backgroundImage = id && SKILLS[id] ? `url(${skillIcon(id, 64).toDataURL()})` : 'none'; b.classList.toggle('empty', !id); });
    }
  },
};
