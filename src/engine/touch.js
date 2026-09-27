/* =====================================================================
   32. 触屏操作（手机 / 平板自动启用，?touch 强制启用）
   左半屏：浮动摇杆（推到底 = 跑步；方向变化会记入指令输入）；右侧：攻击 X / 跳跃 C / 指令 Z / 6 个技能（可翻页）/ 药水 / 背包 / 菜单
   ===================================================================== */
const touch = {
  on: (IS_TOUCH || PARAMS.has('touch')) && !PARAMS.has('bot'), stick: null, dirs: {}, page: 0, skillEls: [], barSig: '',
  init() {
    if (!this.on) return;
    const el = h('div', { id: 'touch' });
    const zone = h('div', { class: 'tzone' }), base = h('div', { class: 'tbase hidden' }), knob = h('div', { class: 'tknob' });
    base.appendChild(knob); zone.appendChild(base);
    const R = () => stage.clientHeight * 0.09;
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
    // 右下角：X 为圆心，C / Z 在内圈，6 个技能 + 翻页在外圈（单位 vh，相对屏幕右下角）
    const CX = 13, CY = 25, place = (b, ang, r, size) => { const a = ang * Math.PI / 180, dx = Math.cos(a) * r, dy = Math.sin(a) * r; Object.assign(b.style, { width: size + 'vh', height: size + 'vh', right: (CX - dx - size / 2) + 'vh', bottom: (CY + dy - size / 2) + 'vh' }); return b; };
    el.append(place(btn('X', 'atk', ...key('attack')), 0, 0, 16), place(btn('C', 'jump', ...key('jump')), 196, 16.5, 10.5), place(btn('Z', 'cmd', ...key('cmd')), 104, 16.5, 10.5), place(btn('闪', 'dodge', ...key('dodge')), 150, 17, 10.5));
    [212, 186, 160, 134, 108, 82].forEach((ang, i) => { const b = place(btn('', 'sk', () => { input.virt['s' + (i + this.page * 6)] = 2; }, () => { delete input.virt['s' + i]; delete input.virt['s' + (i + 6)]; }), ang, 29, 9); this.skillEls.push(b); el.appendChild(b); });
    const misc = h('div', { class: 'tmisc' },
      btn('HP', 'pot hp', ...key('i0')), btn('MP', 'pot mp', ...key('i1')),
      btn('⇅', '', () => { this.page ^= 1; this.barSig = ''; }), btn('包', '', () => menuKey('KeyI')), btn('技', '', () => menuKey('KeyK')), btn('≡', '', () => menuKey('Escape')));
    el.prepend(zone); el.appendChild(misc);
    el.addEventListener('contextmenu', ev => ev.preventDefault());
    document.body.appendChild(el); this.el = el;
    document.body.appendChild(h('div', { id: 'rotate' }, '请把手机横过来玩 ↻'));
  },
  // 每个逻辑帧开始时：摇杆 → 虚拟方向键（新按下的方向记为“按下沿”，这样 ↓→+Z 之类的指令也能搓出来）
  tick() {
    if (!this.el) return;
    this.el.classList.toggle('hidden', game.scene === 'title' || menus.stack.length > 0);
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
      this.skillEls.forEach((b, i) => { const id = game.skillBar[i + this.page * 6]; b.style.backgroundImage = id && SKILLS[id] ? `url(${skillIcon(id, 64).toDataURL()})` : 'none'; b.classList.toggle('empty', !id); });
    }
  },
};
