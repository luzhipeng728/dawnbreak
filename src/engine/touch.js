/* =====================================================================
   32. 触屏操作（手机 / 平板自动启用，?touch 强制启用）：按官方手游《地下城与勇士：起源》的“扇形排列”（调研见 docs/MOBILE.md）
   左：摇杆（默认浮动：手指按哪里摇杆就到哪里；设置里可改成固定），推到底 = 跑步，快速拨两下 = 跑步
   右：大攻击键（按住 = 连续普攻）；跳跃在左下（倒地时点一下 = 受身，按住往下滑 = 后跳）；后跳单独一个键在上方
       10 个技能扇形排在攻击键周围（技能栏 s0..s9：点一下直接放，不用搓指令；按住 = 蓄力 / 持续类技能）
       滑屏键：按住往 上 / 右 / 下 / 左 滑 = 技能栏 s10..s13，点一下 = 上次滑的那个；觉醒键（金框，技能栏里的觉醒技能，最多 2 个）
   左上一列：菜单 / 物品 / 技能 / 任务 / HP / MP 药水；城镇里只留摇杆、攻击、跳跃
   冷却转圈、MP 不足变蓝、装填次数每 0.1 秒刷新一次（不每帧写 DOM）；尺寸单位 U = 屏幕高度的 1%（最多 4.6px），避开刘海 / 底部横条
   设置 → 手机按钮：大小 / 透明度 / 左右互换 / 固定摇杆 / 拖动编辑位置（uiPref touchSize / touchAlpha / touchSwap / touchStickFixed / touchPos）
   打开任何窗口时隐藏虚拟按键（按住的键全部松开）
   ===================================================================== */
// [id, 样式, 角度（0 = 右，90 = 上）, 离攻击键中心的距离, 直径, 技能栏格子]；距离和直径的单位都是 U，攻击键中心离右下角 (16, 17)
const TOUCH_BTNS = [
  ['atk', 'atk', 0, 0, 22], ['jump', 'jump', 200, 25, 12.5], ['bs', 'dodge', 78, 25, 11],
  ...[168, 139, 110].map((a, i) => ['k' + i, 'sk', a, 25, 11, i]),
  ...[192, 173, 154, 135, 116, 97, 78].map((a, i) => ['k' + (i + 3), 'sk', a, 38.5, 11, i + 3]),
  ['slide', 'sk slide', 128, 51.5, 12], ['aw0', 'sk aw', 90, 52, 12], ['aw1', 'sk aw', 106, 52, 12],
];
const TOUCH_SLIDE = ['上', '右', '下', '左'];   // 滑屏键方向 → 技能栏 s10..s13
const touch = {
  on: (IS_TOUCH || PARAMS.has('touch')) && !PARAMS.has('bot'), stick: null, dirs: {}, held: new Set(), pulses: [], btns: [], skillBtns: [],
  slideDir: 0, awSlots: [], uiT: 0, jumpWait: 90, hid: null, town: null, editing: false, pos: {}, U: 4,
  init() {
    if (!this.on) return;
    document.body.classList.add('touchui');
    const el = h('div', { id: 'touch' });
    this.el = el;
    // ---- 摇杆 ----
    const zone = h('div', { class: 'tzone' }), base = h('div', { class: 'tbase' }), knob = h('div', { class: 'tknob' });
    base.appendChild(knob); zone.appendChild(base); el.appendChild(zone);
    Object.assign(this, { zone, base, knob });
    zone.addEventListener('pointerdown', ev => {
      ev.preventDefault(); sfx.init();
      if (this.editing) return this.dragStart(ev, zone, 'stick');
      if (this.stick) return;   // 摇杆区域只认第一根手指
      zone.setPointerCapture(ev.pointerId);
      const r = zone.getBoundingClientRect(), fixed = uiPref('touchStickFixed');
      const x0 = fixed ? r.left + this.rest[0] : ev.clientX, y0 = fixed ? r.top + this.rest[1] : ev.clientY;
      this.stick = { id: ev.pointerId, x0, y0, dx: 0, dy: 0, raw: 0, fixed };
      this.placeBase(x0 - r.left, y0 - r.top); base.classList.add('act');
      this.moveStick(ev);
    });
    zone.addEventListener('pointermove', ev => this.editing ? this.dragMove(ev) : this.moveStick(ev));
    const end = ev => { if (this.editing) return this.dragEnd(ev); if (this.stick && ev.pointerId === this.stick.id) this.stickOff(); };
    for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) zone.addEventListener(t, end);
    // ---- 右侧按键 ----
    const bind = (b, id, down, up, move) => {
      b.addEventListener('pointerdown', ev => {
        ev.preventDefault(); ev.stopPropagation(); sfx.init();
        if (this.editing) return id && this.dragStart(ev, b, id);
        if (b._pid != null) return;
        b.setPointerCapture(ev.pointerId); b._pid = ev.pointerId; b.classList.add('on'); down(ev);
      });
      b.addEventListener('pointermove', ev => { if (this.editing) return this.dragMove(ev); if (move && b._pid === ev.pointerId) move(ev); });
      const u = ev => { if (this.editing) return this.dragEnd(ev); if (b._pid !== ev.pointerId) return; b._pid = null; b.classList.remove('on'); if (up) up(ev); };
      for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(t, u);
      b._release = () => { if (b._pid == null) return; b._pid = null; b.classList.remove('on'); if (up) up(); };
      return b;
    };
    this.bind = bind;
    const keyOf = a => [() => this.press(a), () => this.release(a)];
    const face = b => { b._cd = h('i', { class: 'cd' }); b._cn = h('b', { class: 'cn' }); b._ch = h('em', { class: 'ch' }); b.append(b._cd, b._cn, b._ch); return b; };
    for (const [id, cls, ang, r, d, slot] of TOUCH_BTNS) {
      const b = h('div', { class: 'tbtn ' + cls, 'data-id': id });
      if (id === 'atk') { b.innerHTML = '<svg viewBox="0 0 32 32"><path d="M26.5 5.5l-1.2 5.8-10.6 10.6-4.6-4.6L20.7 6.7z" fill="#fff"/><path d="M8.3 15.7l8 8M12.3 19.7l-5.6 5.6" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><circle cx="5.6" cy="26.4" r="1.9" fill="#fff"/></svg>'; bind(b, id, ...keyOf('attack')); }
      else if (id === 'jump') { b.append(h('span', { class: 'tl' }, '跳跃')); this.jumpBtn(b); }
      else if (id === 'bs') { b.append(h('span', { class: 'tl' }, '后跳')); bind(b, id, () => this.bsOn(), () => this.bsOff()); }
      else if (id === 'slide') { face(b); this.slideBtn(b); }
      else {
        face(b); if (cls.includes('aw')) b.append(h('span', { class: 'awt' }, '觉醒'));
        const aw = id.startsWith('aw') ? +id[2] : -1;
        b._slot = () => aw >= 0 ? this.awSlots[aw] : slot;
        bind(b, id, () => { const s = b._slot(); if (s != null) { b._key = 's' + s; this.press(b._key); } }, () => { if (b._key) this.release(b._key); b._key = null; });
        this.skillBtns.push(b);
      }
      this.btns.push({ id, el: b, ang, r, d }); el.appendChild(b);
    }
    // ---- 状态键：没放进技能栏的 Buff（方向 + 空格那类）/ 受击技能，一点就放（手机上按不了组合键）----
    this.buffBtns = [0, 1, 2, 3, 4].map(i => {
      const b = face(h('div', { class: 'tbtn sk tbuff', 'data-id': 'buff' + i }));
      bind(b, 'buffcol', () => { if (b._id) this.castQ = b._id; }, null);
      el.appendChild(b); return b;
    });
    // ---- 左上一列：菜单 / 药水 ----
    this.col = [['菜单', '', () => uiKey('menu')], ['物品', '', () => uiKey('inv')], ['技能', '', () => uiKey('skills')], ['任务', '', () => uiKey('quests')], ['HP', 'pot hp', ...keyOf('i0')], ['MP', 'pot mp', ...keyOf('i1')]]
      .map(([t, cls, down, up]) => { const b = bind(h('div', { class: 'tbtn tcol ' + cls }, t), null, down, up); el.appendChild(b); return b; });
    // ---- 编辑布局 ----
    this.editBar = h('div', { class: 'tedit hidden' }, h('span', {}, '拖动按钮调整位置'),
      h('button', { class: 'btn', onclick: () => { this.pos = {}; setPref('touchPos', {}); this.layout(); sfx.click(); } }, '恢复默认'),
      h('button', { class: 'btn on', 'data-act': 'done', onclick: () => { this.edit(false); sfx.click(); } }, '完成'));
    el.append(this.editBar, h('div', { id: 'tsafe' }));
    el.addEventListener('contextmenu', ev => ev.preventDefault());
    document.body.appendChild(el);
    // ---- 竖屏提示（竖屏时 game.js 暂停游戏） ----
    const canFs = document.fullscreenEnabled && screen.orientation && screen.orientation.lock;
    document.body.appendChild(h('div', { id: 'rotate' }, h('div', { class: 'rphone' }), h('b', {}, '请把手机横过来玩'), h('span', {}, '竖屏时游戏已暂停'),
      canFs ? h('button', { class: 'btn', onclick: () => document.documentElement.requestFullscreen().then(() => screen.orientation.lock('landscape')).catch(() => {}) }, '全屏横屏') : null));
    addEventListener('resize', () => this.layout());
    this.applyPrefs();
  },
  press(a) { input.virt[a] = 2; this.held.add(a); },
  release(a) { delete input.virt[a]; this.held.delete(a); },
  tap(a) { input.virt[a] = 2; this.pulses.push({ a, n: 2 }); },   // 按下后撑过一个完整的逻辑帧再松开
  // 跳跃：倒地时立刻按（受身）；平时等 90ms 看是不是往下滑（= 后跳），松手或超时就跳
  jumpBtn(b) {
    const fire = () => { const j = this.jp; if (j && j.t) { clearTimeout(j.t); j.t = 0; this.press('jump'); } };
    this.bind(b, 'jump', ev => {
      const p = game.player; this.jp = { y: ev.clientY, t: 0 };
      if (p && p.st === 'down') this.press('jump'); else this.jp.t = setTimeout(fire, this.jumpWait);
    }, () => {
      const j = this.jp; this.jp = null; if (!j) return;
      if (j.t) { clearTimeout(j.t); this.tap('jump'); } else if (j.bs) this.bsOff(); else this.release('jump');
    }, ev => {
      const j = this.jp; if (!j || !j.t || ev.clientY - j.y < this.U * 3) return;
      clearTimeout(j.t); j.t = 0; j.bs = true; this.bsOn();
    });
  },
  // 后跳 = ↓ + 跳跃（技能中 / 受击中要学后跳-强化）；倒地时同样会受身
  bsOn() { if (!input.virt.down) { input.virt.down = 1; this.bsDown = true; } this.press('jump'); },
  bsOff() { this.release('jump'); if (this.bsDown && !this.dirs.down) delete input.virt.down; this.bsDown = false; },
  // 滑屏键：按住往四个方向滑选技能（按下那一刻就放，松手才松键：蓄力类也能用）；点一下 = 上次的方向
  slideBtn(b) {
    b._pts = TOUCH_SLIDE.map((t, i) => { const pt = h('div', { class: 'pt p' + i }); pt._cd = h('i', { class: 'cd' }); pt._cn = h('b', { class: 'cn' }); pt._ch = h('em', { class: 'ch' }); pt.append(pt._cd, pt._cn, pt._ch); b.appendChild(pt); return pt; });
    b._slot = () => 10 + this.slideDir;
    this.bind(b, 'slide', ev => { this.sl = { x: ev.clientX, y: ev.clientY, dir: -1 }; b.classList.add('open'); }, () => {
      const s = this.sl; this.sl = null; b.classList.remove('open'); if (!s) return;
      if (s.dir < 0) this.tap('s' + (10 + this.slideDir)); else this.release('s' + (10 + s.dir));
      b._pts.forEach(p => p.classList.remove('sel')); this.refresh();
    }, ev => {
      const s = this.sl; if (!s || s.dir >= 0) return;
      const dx = ev.clientX - s.x, dy = ev.clientY - s.y; if (Math.hypot(dx, dy) < this.U * 3.5) return;
      s.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy < 0 ? 0 : 2);
      this.slideDir = s.dir; b._pts[s.dir].classList.add('sel'); this.press('s' + (10 + s.dir));
    });
    this.skillBtns.push(b);
  },
  moveStick(ev) {
    const s = this.stick; if (!s || ev.pointerId !== s.id) return;
    const m = this.U * 10; let dx = ev.clientX - s.x0, dy = ev.clientY - s.y0; const l = Math.hypot(dx, dy);
    if (!s.fixed && l > m * 1.3) { const k = (l - m * 1.3) / l; s.x0 += dx * k; s.y0 += dy * k; dx -= dx * k; dy -= dy * k; const r = this.zone.getBoundingClientRect(); this.placeBase(s.x0 - r.left, s.y0 - r.top); }   // 浮动摇杆：手指拖远了底座跟着走
    s.raw = Math.hypot(dx, dy) / m;
    if (s.raw > 1) { dx /= s.raw; dy /= s.raw; }
    s.dx = dx / m; s.dy = dy / m; this.knob.style.transform = `translate(${dx}px,${dy}px)`;
  },
  stickOff() { this.stick = null; this.base.classList.remove('act'); this.knob.style.transform = ''; if (this.rest) this.placeBase(...this.rest); },
  placeBase(x, y) { const R = this.U * 13; this.base.style.left = (x - R) + 'px'; this.base.style.top = (y - R) + 'px'; },
  releaseAll() {
    for (const a of this.held) delete input.virt[a];
    this.held.clear(); this.bsDown = false; delete input.virt.down;
    for (const d in this.dirs) if (this.dirs[d]) { delete input.virt[d]; this.dirs[d] = 0; }
    if (this.jp && this.jp.t) clearTimeout(this.jp.t); this.jp = null; this.sl = null;
    for (const { el } of this.btns) { el.classList.remove('open'); if (el._release) el._release(); }
    if (this.stick) this.stickOff();
  },
  // 安全区（刘海 / 底部横条）：读一个用 env(safe-area-inset-*) 做内边距的隐形元素
  safe() { const s = getComputedStyle(document.getElementById('tsafe')); return { top: parseFloat(s.paddingTop) || 0, right: parseFloat(s.paddingRight) || 0, bottom: parseFloat(s.paddingBottom) || 0, left: parseFloat(s.paddingLeft) || 0 }; },
  applyPrefs() { if (!this.el) return; this.pos = { ...(uiPref('touchPos') || {}) }; this.layout(); },
  // 按设置摆放：大小倍率、透明度、左右互换、拖动过的位置（touchPos[id] = [往里, 往上]，单位 U）
  layout() {
    if (!this.el) return;
    const U = this.U = Math.min(innerHeight, 460) / 100 * uiPref('touchSize'), sw = !!uiPref('touchSwap'), sf = this.safe(), pos = this.pos;
    const side = sw ? 'left' : 'right', other = sw ? 'right' : 'left';
    this.el.style.fontSize = U + 'px'; this.el.style.opacity = this.editing ? 1 : uiPref('touchAlpha');
    for (const { id, el, ang, r, d } of this.btns) {
      const [ox, oy] = pos[id] || [0, 0], a = ang * Math.PI / 180, cx = 16 - Math.cos(a) * r + ox, cy = 17 + Math.sin(a) * r + oy;
      Object.assign(el.style, { width: d * U + 'px', height: d * U + 'px', bottom: sf.bottom + (cy - d / 2) * U + 'px', [side]: sf[side] + (cx - d / 2) * U + 'px', [other]: '' });
    }
    const [bx, by] = pos.buffcol || [0, 0];
    // 状态键一列 4 个；第 5 个（格斗家气功师有 5 个 Buff）放在最上面一格的里侧
    this.buffBtns.forEach((b, i) => { const d = 7.5, cx = 4 + (i > 3 ? 8.2 : 0) + bx, cy = 64 + Math.min(i, 3) * 8.2 + by; Object.assign(b.style, { width: d * U + 'px', height: d * U + 'px', bottom: sf.bottom + (cy - d / 2) * U + 'px', [side]: sf[side] + (cx - d / 2) * U + 'px', [other]: '' }); });
    this.col.forEach((b, i) => Object.assign(b.style, { width: 8 * U + 'px', height: 8 * U + 'px', top: sf.top + (2.5 + i * 9.4 + (i >= 4 ? 2.5 : 0)) * U + 'px', [other]: sf[other] + 1.5 * U + 'px', [side]: '' }));
    this.zone.classList.toggle('swap', sw);
    const st = stage.getBoundingClientRect(), colR = sw ? 0 : sf.left + 9.5 * U;   // hud.js 的左上角状态条避开这一列按钮（逻辑坐标）
    this.hudX = Math.max(0, (colR - st.left) * UW / st.width) + 20;
    Object.assign(this.base.style, { width: 26 * U + 'px', height: 26 * U + 'px' });
    Object.assign(this.knob.style, { width: 11 * U + 'px', height: 11 * U + 'px', margin: -5.5 * U + 'px 0 0 ' + -5.5 * U + 'px' });
    const [ox, oy] = pos.stick || [0, 0], zw = this.zone.clientWidth, zh = this.zone.clientHeight, x = sf[other] + (24 + ox) * U;
    this.rest = [sw ? zw - x : x, zh - sf.bottom - (23 + oy) * U];
    if (!this.stick) this.placeBase(...this.rest);
  },
  edit(on) {
    this.releaseAll(); this.editing = on; this.pos = { ...(uiPref('touchPos') || {}) };
    this.el.classList.toggle('editing', on); this.editBar.classList.toggle('hidden', !on);
    if (on) { this.el.classList.remove('hidden', 'town'); this.hid = false; this.town = null; }
    this.layout();
  },
  dragStart(ev, el, id) { el.setPointerCapture(ev.pointerId); this.drag = { id, pid: ev.pointerId, x0: ev.clientX, y0: ev.clientY, o: [...(this.pos[id] || [0, 0])] }; },
  dragMove(ev) {
    const d = this.drag; if (!d || d.pid !== ev.pointerId) return;
    const inward = (d.id === 'stick' ? 1 : -1) * (uiPref('touchSwap') ? -1 : 1);
    this.pos[d.id] = [+(d.o[0] + inward * (ev.clientX - d.x0) / this.U).toFixed(1), +(d.o[1] - (ev.clientY - d.y0) / this.U).toFixed(1)];
    this.layout();
  },
  dragEnd(ev) { if (!this.drag || this.drag.pid !== ev.pointerId) return; this.drag = null; setPref('touchPos', { ...this.pos }); },
  // 每个逻辑帧开始时：摇杆 → 虚拟方向键（新按下的方向记为“按下沿”，双击跑 / ↓→ 这类指令照样能用）
  tick() {
    if (!this.el) return;
    const hide = !this.editing && (game.scene === 'title' || !game.player || menus.stack.length > 0);
    if (hide !== this.hid) { this.hid = hide; this.el.classList.toggle('hidden', hide); if (hide) this.releaseAll(); }
    for (let i = this.pulses.length - 1; i >= 0; i--) { const q = this.pulses[i]; if (--q.n <= 0) { if (!this.held.has(q.a)) delete input.virt[q.a]; this.pulses.splice(i, 1); } }
    if (this.castQ) { const id = this.castQ; this.castQ = null; if (!this.editing && !hide && game.player) castSkill(game.player, id, true); }
    if (this.editing || hide) return;
    const s = this.stick, want = {};
    if (s) { if (s.dx > 0.38) want.right = 1; if (s.dx < -0.38) want.left = 1; if (s.dy > 0.45) want.down = 1; if (s.dy < -0.45) want.up = 1; }
    for (const d of ['left', 'right', 'up', 'down']) {
      if (want[d]) { input.virt[d] = this.dirs[d] ? (input.virt[d] || 1) : 2; this.dirs[d] = 1; }
      else if (this.dirs[d]) { if (!(d === 'down' && this.bsDown)) delete input.virt[d]; this.dirs[d] = 0; }
    }
    if (s && s.raw >= 0.95 && Math.abs(s.dx) >= 0.7) input.runDir = Math.sign(s.dx);   // 推到底 = 跑；松开方向时 input.frame 会停跑
    const now = performance.now(); if (now - this.uiT >= 100) { this.uiT = now; this.refresh(); }
  },
  // 按钮图标 / 冷却 / MP 不足：最多每 0.1 秒一次，只在值变了的时候写 DOM
  refresh() {
    const p = game.player; if (!p || !this.el) return;
    const town = game.scene === 'town' && !this.editing; if (town !== this.town) { this.town = town; this.el.classList.toggle('town', town); }
    if (town) return;
    const bar = game.skillBar, aw = [];
    bar.forEach((id, i) => { if (id && SKILLS[id] && SKILLS[id].awaken) aw.push(i); });
    aw.sort((a, b) => tierOf(SKILLS[bar[b]]) - tierOf(SKILLS[bar[a]]) || a - b); this.awSlots = aw.slice(0, 2);
    const ids = touchBuffSkills(p, bar);
    this.buffBtns.forEach((b, i) => { const id = ids[i] || null; this.face(b, id, p); b.classList.toggle('hidden', !id && !this.editing); });
    for (const b of this.skillBtns) {
      const s = b._slot(); this.face(b, s == null ? null : bar[s], p);
      if (b.classList.contains('aw')) b.classList.toggle('hidden', s == null && !this.editing);
      if (b._pts) b._pts.forEach((pt, i) => this.face(pt, bar[10 + i], p));
    }
  },
  face(b, id, p) {
    const S = id && SKILLS[id] ? SKILLS[id] : null;
    if (b._id !== id) { b._id = id; b.style.backgroundImage = S ? `url(${skillIcon(id, 64).toDataURL()})` : 'none'; b.classList.toggle('empty', !S); }
    const cd = S ? p.cool[id] || 0 : 0, f = cd > 0 ? Math.round(clamp(cd / ((S.cd || 1) * (p.cdMul || 1)), 0, 1) * 100) : 0;
    if (b._f !== f) { b._f = f; b.style.setProperty('--cd', f + '%'); }
    const txt = cd > 0 ? (cd >= 1 ? Math.ceil(cd) + '' : cd.toFixed(1)) : '';
    if (b._t !== txt) { b._t = txt; b._cn.textContent = txt; }
    const lv = S ? game.skillLv[id] || 0 : 0, q = S && S.charges ? (p.charges && p.charges[id] ? p.charges[id].n : S.charges) : null, ch = q == null ? '' : '×' + q;
    if (b._q !== ch) { b._q = ch; b._ch.textContent = ch; }
    const st = !S ? '' : lv <= 0 || (S.job && S.job !== game.job) ? 'lock' : cd <= 0 && p.mp < (S.mp || 0) ? 'nomp' : S.recast && S.recast.ok(p) ? 'recast' : '';
    if (b._st !== st) { if (b._st) b.classList.remove(b._st); if (st) b.classList.add(st); b._st = st; }
  },
};

// 状态键里放哪些技能：学会了、当前转职能用、不是被动 / 觉醒、没在技能栏里的 Buff 类（方向 + 空格、S.buff）和受击技能（S.whenHit），最多 5 个；
// 真正的 Buff / 受击技能排前面，其余“方向 + 空格”的攻击技能（分身、瞬步、念气罩……）排后面，各自按学习等级排（格斗家气功师 5 个 Buff 都放得下）
function touchBuffSkills(p, bar) {
  const C = CLASSES[p.cls], on = new Set(bar.filter(Boolean)), out = [], seen = new Set();
  const cand = [...(C.cmds || []).filter(c => c[2] === 'buff').map(c => c[1]), ...Object.keys(SKILLS).filter(id => SKILLS[id].cls === p.cls && (SKILLS[id].buff || SKILLS[id].whenHit))];
  for (const id of cand) {
    const S = SKILLS[id]; if (!S || seen.has(id)) continue; seen.add(id);
    if (S.passive || S.awaken || on.has(id) || (S.job && S.job !== game.job) || !(skillLvOf(p, id) > 0) || !(S.act || S.instant)) continue;
    out.push(id);
  }
  const rank = id => SKILLS[id].buff || SKILLS[id].whenHit ? 0 : 1;
  return out.sort((a, b) => rank(a) - rank(b) || (SKILLS[a].lvReq || 0) - (SKILLS[b].lvReq || 0)).slice(0, 5);
}
