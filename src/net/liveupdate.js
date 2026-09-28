/* =====================================================================
   在线更新：发现新版本 → 右下角小横幅（不挡操作）→ 一键更新：先存档、上传云存档，刷新后跳过标题 / 选角，回到原来的场景和位置
   - 版本号 BUILD_ID：build.mjs 按网页版内容算；部署时最后才上传 dist/web/version.json { id, time, notes }（tools/deploy.sh）
   - 检测：每 60 秒 + 切回前台 / 窗口获得焦点时拉一次 version.json；离线单文件、带调试参数（?test / ?town …）的页面不检测
   - 地下城 / 决斗 / 组队刷图中：“打完这局再更新”（回城 5 秒后自动更新，可取消）或“立即更新”（放弃本局）；
     城镇里点“稍后”也一样：这个版本不再提示，下次打完一局回城时自动更新
   - 续玩状态存在 sessionStorage（只对这个标签页、2 分钟内有效）：角色、场景坐标、开着的窗口、聊天频道、队伍；
     登录账号时等 account.boot 和云端对完版本再进（save.key 已切到账号存档）；队伍靠服务端的掉线宽限期保留，重连后自动回到队里
   ===================================================================== */
const LU_KEY = 'dawnbreak_resume', LU_EVERY = 60000, LU_COUNT = 5;
const LU_WINS = new Set([...Object.values(UI_WIN), 'party']);   // 刷新后重新打开的窗口（不需要参数的常用窗口）
const liveUpdate = {
  on: BUILD_MODE === 'web' && /^https?:$/.test(location.protocol) && !['test', 'town', 'dungeon', 'bot', 'cls', 'duel', 'art', 'fresh', 'offline', 'lv'].some(k => PARAMS.has(k)),
  latest: null, shown: false, deferred: false, away: false, count: 0, updating: false, lastCheck: 0, el: null,
  init() {
    if (!this.on) return;
    setInterval(() => this.check(), LU_EVERY);
    setInterval(() => this.tick(), 1000);
    setTimeout(() => this.check(), 5000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.check(); });
    addEventListener('focus', () => this.check());
  },
  async check(force) {
    if (!this.on || this.updating) return;
    const now = Date.now(); if (!force && now - this.lastCheck < 10000) return;
    this.lastCheck = now;
    let j = null;
    try { const r = await fetch('version.json?t=' + now, { cache: 'no-store' }); if (r.ok) j = await r.json(); } catch (e) { return; }
    if (!j || !j.id || j.id === BUILD_ID) return;
    const fresh = !this.latest || this.latest.id !== j.id;
    this.latest = j;
    if (fresh && !this.deferred) this.shown = true;
    this.render();
  },
  // 地下城 / 决斗 / 组队刷图中（刷新会中断这一局）
  busy() { const s = game.scene; return !!game.player && (s === 'dungeon' || s === 'test' || coop.active() || netDuel.active() || !!arena.cur); },
  tick() {
    if (!this.latest || this.updating) return;
    if (this.busy()) { this.away = true; this.count = 0; }
    else if (this.away && game.scene === 'town') { this.away = false; if (this.deferred) this.count = LU_COUNT; }   // 打完一局回到城镇
    else if (this.count && --this.count <= 0) { this.update(); return; }
    this.render();
  },
  later() { this.deferred = true; this.away = this.busy(); this.count = 0; this.render(); },
  cancel() { this.count = 0; this.render(); },
  // 立即更新；打到一半要先确认放弃本局
  now() {
    if (!this.busy()) { this.update(); return; }
    netAsk('liveupdate', { title: '立即更新', danger: true, okText: '放弃本局并更新', cancelText: '打完再更新',
      text: '现在更新会<b>放弃当前这一局</b>（地下城 / 决斗），刷新后回到城镇。<br>已经拿到的经验、金币和物品会保存。',
      ok: () => this.update(true), cancel: () => this.later() });
  },
  mode() {
    if (this.updating) return 'saving';
    if (this.count) return 'count';
    if (this.deferred) return this.busy() ? 'wait' : null;
    return this.shown ? (this.busy() ? 'run' : 'new') : null;
  },
  render() {
    const m = this.mode();
    if (!this.el) { this.el = h('div', { id: 'lubar', hidden: '' }); dom.appendChild(this.el); }
    this.el.hidden = !m;
    // 叠在右下角菜单按钮栏的上面（栏的行数会变）；地下城里再让开栏上方的实时评价面板（game/dungeon.js，高 106/1080）
    const mb = menubar.el && !menubar.el.hidden && menubar.el.getBoundingClientRect();
    this.el.style.bottom = mb && mb.height ? (dom.getBoundingClientRect().bottom - mb.top + 6 + (game.scene === 'dungeon' ? dom.clientHeight * 110 / 1080 : 0)) + 'px' : '';
    const sig = m + this.count + this.latest.id;
    if (!m || this.el.dataset.m === sig) return;
    this.el.dataset.m = sig;
    const B = (label, cls, fn) => h('button', { class: 'btn' + (cls ? ' ' + cls : ''), onclick: e => { e.stopPropagation(); e.currentTarget.blur(); sfx.click(); fn(); } }, label);
    const notes = this.latest && this.latest.notes ? h('div', { class: 'lunotes', title: this.latest.notes }, '更新内容：' + this.latest.notes) : null;
    const rows = {
      new: [h('div', { class: 'lut' }, '发现新版本 · 点击更新'), h('div', { class: 'lus' }, '进度自动保存，更新后回到当前位置'), notes, h('div', { class: 'lub' }, B('更新', '', () => this.update()), B('稍后', 'blue', () => this.later()))],
      run: [h('div', { class: 'lut' }, '发现新版本'), h('div', { class: 'lus' }, '正在地下城 / 决斗中：打完这局回城后自动更新'), notes, h('div', { class: 'lub' }, B('打完这局再更新', '', () => this.later()), B('立即更新', 'red', () => this.now()))],
      wait: [h('div', { class: 'lus' }, '新版本 · 回城后自动更新'), h('div', { class: 'lub' }, B('立即更新', 'red', () => this.now()))],
      count: [h('div', { class: 'lut' }, `${this.count} 秒后自动更新`), h('div', { class: 'lus' }, '进度自动保存，更新后回到当前位置'), h('div', { class: 'lub' }, B('现在更新', '', () => this.update()), B('取消', 'blue', () => this.cancel()))],
      saving: [h('div', { class: 'lut' }, '正在保存进度并更新…')],
    };
    this.el.className = 'lu-' + m;
    this.el.onclick = m === 'new' ? () => { sfx.click(); this.update(); } : null;   // 整条横幅都能点（地下城里不行：免得误点放弃本局）
    this.el.replaceChildren(...rows[m].filter(Boolean));
  },
  // 存档 → 上传云存档（最多等 8 秒，没传上的下次启动自动补传）→ 记下续玩状态 → 刷新
  async update(abandon) {
    if (this.updating) return;
    this.updating = true; this.count = 0; this.render();
    const st = this.snapshot();
    try {
      if (abandon && coop.active()) coop.end('abort');
      if (abandon && netDuel.active() && netDuel.room) net.send({ t: netDuel.role === 'host' ? 'room:close' : 'room:leave' });
      if (save.data && save.live) save.write();
      if (cloudSave.active()) await Promise.race([cloudSave.flush(), new Promise(r => setTimeout(r, 8000))]);
      if (st) sessionStorage.setItem(LU_KEY, JSON.stringify(st));
    } catch (e) { console.error('更新前保存出错', e); }
    location.reload();
  },
  snapshot() {
    if (!game.player || !save.data || save.cur < 0) return null;
    const p = game.player, town = game.scene === 'town' && world && !this.busy();
    if (town) save.data.loc = { scene: world.S.id, x: Math.round(p.x), y: Math.round(p.y), face: p.face };   // 城镇里：精确到当前位置；地下城里：存档里的是进门时的门口
    return { key: save.key, cur: save.cur, name: save.data.name, cls: save.data.cls, loc: save.data.loc,
      wins: town ? menus.stack.filter(n => LU_WINS.has(n)) : [], ch: chat.ch, to: chat.toEl ? chat.toEl.value : '',
      party: netParty.p ? netParty.p.id : null, from: BUILD_ID, at: Date.now() };
  },
  // 启动时取出续玩状态（取一次就删掉：之后手动刷新照常走标题）
  take() {
    let st = null;
    try { st = JSON.parse(sessionStorage.getItem(LU_KEY) || 'null'); sessionStorage.removeItem(LU_KEY); } catch (e) { return null; }
    return this.on && st && Date.now() - st.at < 120000 ? st : null;
  },
  // 回到刷新前的角色 / 场景 / 位置；对不上（换了账号、角色没了、存档冲突）返回 false，走正常标题
  async resume(st) {
    if (st.key !== save.key) return false;
    if (account.syncing) { const r = await Promise.race([account.syncing, new Promise(res => setTimeout(() => res('slow'), 10000))]); if (r === 'conflict') return false; }
    if (!save.loadAll()) return false;
    let i = st.cur;
    if (!save.chars[i] || save.chars[i].name !== st.name || save.chars[i].cls !== st.cls) i = save.chars.findIndex(c => c.name === st.name && c.cls === st.cls);
    if (i < 0) return false;
    save.select(i); save.apply();
    if (st.loc && SCENES[st.loc.scene]) save.data.loc = st.loc;
    if (st.party) netParty.lastPid = st.party;   // 同一个队伍：重连后不再提示“已加入队伍”
    await startGame(save.data.cls);
    if (menus.isOpen('help')) menus.close('help');
    for (const n of st.wins || []) try { menus.show(n); } catch (e) { console.error('续玩：打开窗口出错', n, e); }
    if (st.ch && CHAT_CH[st.ch]) { if (!chat.el && netOn()) chat.build(); if (chat.chBtn) { chat.setCh(st.ch); if (st.to) chat.toEl.value = st.to; } }
    if (st.from !== BUILD_ID) toastMsg('已更新到最新版本', '#8aff9a', 'banner');
    return true;
  },
};
addStyle(`#lubar{position:absolute;right:calc(var(--u) * 8px);bottom:calc(var(--u) * 8px);width:calc(var(--u) * 266px);box-sizing:border-box;z-index:9000;padding:.5em .65em;border:.08em solid #e8c26a;border-radius:.35em;background:linear-gradient(rgba(58,46,34,.94),rgba(26,19,13,.94));color:#f0dcb0;box-shadow:0 .2em .8em rgba(0,0,0,.5);font-size:.82em;line-height:1.4;animation:luin .35s ease-out}
#lubar.lu-new{cursor:pointer}#lubar.lu-new:hover{border-color:#ffd23a;background:linear-gradient(rgba(90,68,40,.96),rgba(42,29,16,.96))}
#lubar.lu-wait{padding:.3em .5em;display:flex;align-items:center;justify-content:space-between;gap:.5em;border-color:#6a5436}
#lubar .lut{font-weight:900;color:#ffd23a;font-size:1.08em}#lubar .lus{color:#e8d8b8}
#lubar .lunotes{margin-top:.25em;color:#bfae8c;font-size:.9em;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
#lubar .lub{display:flex;gap:.4em;justify-content:flex-end;margin-top:.35em}#lubar.lu-wait .lub{margin-top:0}
#lubar .btn{font-size:.95em;padding:.2em .7em}
@keyframes luin{from{opacity:0;transform:translateY(.6em)}to{opacity:1;transform:none}}`);
liveUpdate.init();
