/* =====================================================================
   账号与云存档（客户端）
   - 登录后存档改用账号自己的本地缓存（localStorage dawnbreak_cloud_<uid>，账号金库 dawnbreak_bank_cloud_<uid>），以云端为准
   - 每次 save.write() / 删除角色 / 金库变化 → 标记“有改动”，防抖 2 秒上传（PUT /api/saves，带 baseUpdatedAt）
   - 断网：照常写本地缓存，恢复后自动补传（启动时也会检查上次没传上去的改动）
   - 冲突（云端在别处被改过，服务端返回 409）：让玩家选“用云端存档”还是“用本机覆盖云端”
   - 第一次登录时，如果本机有没登录时玩的角色，提示上传到账号
   对外：cloudSave.flush() → Promise<boolean>（立即上传；给拍卖 / 邮件等需要先落盘再调接口的操作用，全局别名 netSaveFlush）
   ===================================================================== */
const LOCAL_SAVE_KEY = 'dawnbreak_save_v1';
const cloudSave = {
  uid: 0, base: 0, dirty: false, rev: '', sent: [], timer: 0, busy: null, state: 'idle', lastSync: 0, err: '', conflictOpen: false, checked: false, retry: 0,
  key(uid = this.uid || (net.user && net.user.id)) { return uid ? 'dawnbreak_cloud_' + uid : null; },
  bankKey(uid = this.uid) { return 'dawnbreak_bank_cloud_' + uid; },
  metaKey(uid = this.uid) { return 'dawnbreak_cloudmeta_' + uid; },
  active() { return !!this.uid && save.key === this.key(this.uid); },
  // meta：base = 本地缓存基于的云端版本；dirty = 有没上传的改动；rev = 本地当前内容的编号；sent = 最近上传过的内容编号
  // （上传请求发出后页面被关掉、没收到回应时，下次启动看到云端的 _rev 是自己传的，就知道不是冲突）
  readMeta() { try { return JSON.parse(localStorage.getItem(this.metaKey()) || 'null') || {}; } catch (e) { return {}; } },
  writeMeta() { try { localStorage.setItem(this.metaKey(), JSON.stringify({ base: this.base, dirty: this.dirty, rev: this.rev, sent: this.sent.slice(-20), lastSync: this.lastSync })); } catch (e) { /* 存储已满 */ } },
  newRev() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); },
  mine(rev) { return !!rev && (rev === this.rev || this.sent.includes(rev)); },
  // 切到某个账号的存档（启动时 / 登录后调用）：save.key 指向账号缓存
  use(uid) {
    this.uid = uid; const m = this.readMeta();
    this.base = m.base || 0; this.dirty = !!m.dirty; this.rev = m.rev || ''; this.sent = Array.isArray(m.sent) ? m.sent : []; this.lastSync = m.lastSync || 0;
    if (save.key === LOCAL_SAVE_KEY || save.key.startsWith('dawnbreak_cloud_')) save.key = this.key(uid);
    bank.loadedKey = null;
  },
  // 离开账号（登出）：回到本机存档
  leave() { clearTimeout(this.timer); this.uid = 0; this.checked = false; if (save.key.startsWith('dawnbreak_cloud_')) save.key = LOCAL_SAVE_KEY; bank.loadedKey = null; },
  // 本地缓存 → 上传用的对象
  payload() {
    let d = null; try { d = JSON.parse(localStorage.getItem(this.key()) || 'null'); } catch (e) { d = null; }
    if (!d) d = { v: SAVE_V, cur: -1, chars: [] };
    let b = null; try { b = JSON.parse(localStorage.getItem(this.bankKey()) || 'null'); } catch (e) { b = null; }
    if (b) d.bank = b;
    return d;
  },
  // 云端数据 → 本地缓存
  adopt(data, updatedAt) {
    const d = data || { v: SAVE_V, cur: -1, chars: [] }, b = d.bank; delete d.bank;
    this.rev = d._rev || ''; delete d._rev;
    try { localStorage.setItem(this.key(), JSON.stringify(d)); if (b) localStorage.setItem(this.bankKey(), JSON.stringify(b)); else localStorage.removeItem(this.bankKey()); } catch (e) { /* 存储已满 */ }
    bank.loadedKey = null;
    this.base = updatedAt || 0; this.dirty = false; this.lastSync = Date.now(); this.writeMeta();
  },
  // 本地有改动（save.write / 删除角色 / 金库）
  changed() {
    if (!this.active()) return;
    this.rev = this.newRev(); this.dirty = true; this.writeMeta();
    if (this.checked && !this.conflictOpen) this.schedule(2000);
  },
  schedule(ms) { clearTimeout(this.timer); this.timer = setTimeout(() => this.flush(), ms); },
  // 立即上传；返回是否成功（没有改动也算成功）
  flush(force) {
    if (!this.active() || !netOn()) return Promise.resolve(false);
    if (this.busy) return this.busy.then(() => this.dirty ? this.flush(force) : true);
    if (!this.dirty && !force) return Promise.resolve(true);
    if (!this.checked && !force) return Promise.resolve(false);   // 还没和云端对过版本，先别传
    clearTimeout(this.timer);
    if (!this.rev) this.rev = this.newRev();
    const rev = this.rev, data = this.payload(); data._rev = rev;
    if (!this.sent.includes(rev)) { this.sent.push(rev); if (this.sent.length > 20) this.sent.shift(); this.writeMeta(); }
    this.state = 'sync';
    this.busy = net.api('PUT', '/api/saves', { data, baseUpdatedAt: this.base, force: !!force }, { timeout: 20000 }).then(r => {
      this.base = r.updatedAt; this.lastSync = Date.now(); this.retry = 0; this.err = '';
      if (this.rev === rev) this.dirty = false; else this.schedule(2000);
      this.writeMeta(); this.state = 'ok'; bus.emit('cloudSync', { ok: true });
      return true;
    }, e => {
      if (e.status === 409) return this.recheck();
      if (e.status === 401) { this.state = 'error'; return false; }
      this.state = 'offline'; this.err = e.message;
      this.schedule(Math.min(60000, 4000 * Math.pow(1.6, this.retry++)));   // 断网：退避重试（上限 1 分钟）
      bus.emit('cloudSync', { ok: false, offline: true });
      return false;
    }).finally(() => { this.busy = null; });
    return this.busy;
  },
  // 上传被拒（409）：看看云端那份是不是其实就是自己早先传上去的（回应丢了）；是就接着传，不是才算真冲突
  async recheck() {
    let r; try { r = await net.api('GET', '/api/saves'); } catch (e) { this.state = 'offline'; this.schedule(8000); return false; }
    if (r.data && this.mine(r.data._rev)) { this.base = r.updatedAt; this.writeMeta(); this.busy = null; return this.dirty ? this.flush() : true; }
    this.state = 'conflict'; this.conflict(r.updatedAt, r); return false;
  },
  // 登录 / 启动后和云端对版本
  async check() {
    if (!this.uid || !netOn()) return 'nouser';
    let r;
    try { r = await net.api('GET', '/api/saves', undefined, { timeout: 15000 }); }
    catch (e) { this.state = 'offline'; this.err = e.message; if (e.status !== 401) setTimeout(() => { if (!this.checked && netOn()) this.check(); }, 8000); return 'offline'; }
    this.checked = true;
    const localHas = !!localStorage.getItem(this.key());
    if (!r.updatedAt) {   // 云端还没有存档
      if (localHas && this.dirty) { await this.flush(true); return 'pushed'; }
      this.adopt(null, 0); return 'empty';
    }
    if (this.dirty && localHas) {
      if (r.data && r.data._rev === this.rev) { this.base = r.updatedAt; this.dirty = false; this.lastSync = Date.now(); this.writeMeta(); this.state = 'ok'; return 'cloud'; }   // 上次的上传其实成功了
      if (this.base === r.updatedAt || (r.data && this.mine(r.data._rev))) { this.base = r.updatedAt; await this.flush(); return 'pushed'; }   // 上次没传上去的改动：补传
      this.conflict(r.updatedAt, r); return 'conflict';
    }
    if (r.updatedAt !== this.base || !localHas) this.adopt(r.data, r.updatedAt);
    this.state = 'ok';
    return 'cloud';
  },
  // 冲突：玩家选择
  conflict(cloudAt, got) {
    if (this.conflictOpen) return; this.conflictOpen = true; clearTimeout(this.timer);
    const when = t => t ? new Date(t).toLocaleString('zh-CN', { hour12: false }) : '未知';
    const local = this.payload(), desc = d => (d.chars || []).map(c => `${escHtml(c.name || '')} Lv.${c.lvl || 1}`).join('、') || '（没有角色）';
    const show = cloud => netAsk('conflict', {
      title: '云存档冲突', noEsc: true,
      text: `账号的云端存档在别的地方（另一台设备或另一个标签页）更新过，和这台电脑上的进度不一致。<br><br>` +
        `<b>云端</b>（${when(cloudAt)}）：${cloud ? desc(cloud) : '读取中…'}<br><b>本机</b>（未上传的进度）：${desc(local)}<br><br>请选择保留哪一份（另一份会被覆盖）：`,
      okText: '使用云端存档', cancelText: '用本机覆盖云端',
      ok: () => { this.conflictOpen = false; this.useCloud(); },
      cancel: () => { this.conflictOpen = false; this.flush(true).then(ok => toastMsg(ok ? '已用本机进度覆盖云端存档' : '上传失败，稍后会自动重试', ok ? '#8aff9a' : '#ff9a6a')); },
    });
    if (got) show(got.data); else net.api('GET', '/api/saves').then(r => show(r.data), () => show(null));
  },
  async useCloud() {
    let r; try { r = await net.api('GET', '/api/saves'); } catch (e) { toastMsg('读取云端存档失败：' + e.message, '#ff6a6a'); return; }
    const inGame = !!game.player;
    save.live = false;   // 先停写，避免当前游戏状态把刚拿到的云端存档覆盖掉
    this.adopt(r.data, r.updatedAt); this.checked = true;
    toastMsg('已切换到云端存档', '#8aff9a');
    if (inGame && typeof backToCharSelect === 'function' && game.scene !== 'dungeon') backToCharSelect();   // save.live 已关：不会把当前状态写回去
    else if (inGame) location.reload();
    else if (menus.isOpen('charselect')) menus.refresh('charselect');
    else if (menus.isOpen('title')) menus.refresh('title');
  },
  // 本机（未登录时玩的）存档里的角色：不认识的职业（新版本的职业）也原样带上，不能丢（docs/CLASS_PLAN_FIGHTER.md #20）
  localChars() { try { const d = JSON.parse(localStorage.getItem(LOCAL_SAVE_KEY) || 'null'); return d ? (d.chars || [d]).filter(c => c && typeof c === 'object' && typeof c.cls === 'string') : []; } catch (e) { return []; } },
  // 把本机角色追加到账号（名字重复的自动加后缀；超出角色位上限的不传）
  importLocal() {
    const add = this.localChars(); if (!add.length) return { n: 0, skipped: 0 };
    const d = this.payload(), chars = d.chars || (d.chars = []);
    let n = 0, skipped = 0;
    for (const c of add) {
      if (chars.length >= MAX_CHARS) { skipped++; continue; }
      const cc = JSON.parse(JSON.stringify(c)); let nm = cc.name || '勇士', k = 2;
      while (chars.some(x => (x.name || '').toLowerCase() === nm.toLowerCase())) nm = (cc.name || '勇士').slice(0, 5) + k++;
      cc.name = nm; chars.push(cc); n++;
    }
    if (d.cur < 0 && chars.length) d.cur = 0;
    const b = d.bank; delete d.bank;
    try { localStorage.setItem(this.key(), JSON.stringify(d)); } catch (e) { /* */ }
    if (!b) { try { const lb = localStorage.getItem('dawnbreak_bank'); if (lb) localStorage.setItem(this.bankKey(), lb); } catch (e) { /* */ } bank.loadedKey = null; }   // 账号金库是空的：顺带把本机金库带上
    this.rev = this.newRev(); this.dirty = true; this.writeMeta();
    try { localStorage.setItem('dawnbreak_uploaded_' + this.uid, String(Date.now())); } catch (e) { /* */ }
    return { n, skipped };
  },
  // 第一次登录：本机有角色、账号还没提示过 → 询问是否上传
  offerImport(done) {
    const loc = this.localChars(), asked = localStorage.getItem('dawnbreak_uploaded_' + this.uid);
    if (!loc.length || asked) { done && done(); return; }
    const d = this.payload(), room = MAX_CHARS - (d.chars || []).length;
    netAsk('import', {
      title: '上传本机角色',
      text: `这台电脑上有 ${loc.length} 个没登录时创建的角色：<br><b>${loc.map(c => `${escHtml(c.name || '')} Lv.${c.lvl || 1}`).join('、')}</b><br><br>要把它们上传到账号「${escHtml(net.user.name)}」吗？上传后在任何设备登录都能继续玩（本机原来的存档不会删除）。` +
        (room < loc.length ? `<br><span style="color:#ffb08a">账号只剩 ${Math.max(0, room)} 个空角色位，多出来的角色不会上传。</span>` : ''),
      okText: '上传到账号', cancelText: '暂不上传',
      ok: () => { const r = this.importLocal(); this.flush().then(ok => toastMsg(ok ? `已上传 ${r.n} 个角色到账号` : '已加入账号，稍后自动上传', '#8aff9a')); done && done(); },
      cancel: () => { try { localStorage.setItem('dawnbreak_uploaded_' + this.uid, 'no'); } catch (e) { /* */ } done && done(); },
    });
  },
};
const netSaveFlush = () => cloudSave.flush();
// 账号金库：登录后按账号分开存，并随云存档同步
const _bankKey = bank.key, _bankWrite = bank.write;
bank.key = function () { return cloudSave.active() ? cloudSave.bankKey() : _bankKey.call(this); };
bank.write = function () { _bankWrite.call(this); cloudSave.changed(); };
// 离开页面 / 切到后台：马上补传（关页面时大存档不一定来得及，下次打开会自动补传）
document.addEventListener('visibilitychange', () => { if (document.hidden && cloudSave.dirty) cloudSave.flush(); });

/* ---- 登录流程 ---- */
const account = {
  // 页面启动：有保存的登录 → 切到账号存档，后台核对 token 与云端版本
  boot() {
    if (!netOn() || save.key === 'dawnbreak_dev' || save.key === 'dawnbreak_duel') return;
    cloudSave.use(net.user.id);
    this.syncing = cloudSave.check().then(r => {
      this.syncing = null;
      if (r === 'cloud' || r === 'empty') { if (menus.isOpen('title')) menus.refresh('title'); if (menus.isOpen('charselect') && !game.player) menus.refresh('charselect'); }
      return r;
    });
    net.connect();
  },
  // 登录 / 注册成功
  async onLogin(r) {
    net.setLogin(r.token, r.user);
    cloudSave.use(r.user.id);
    const res = await cloudSave.check();
    if (res === 'offline') toastMsg('读取云存档失败，先用本机缓存，恢复网络后自动同步', '#ffb08a');
    return res;
  },
  async logout() {
    if (cloudSave.dirty) {
      const ok = await cloudSave.flush();
      if (!ok) { netAsk('logout', { title: '还有进度没上传', text: '网络好像断了，最近的进度还没传到云端。现在登出的话这部分进度会留在这台电脑上，下次登录会自动补传。确定登出吗？', okText: '仍然登出', danger: true, ok: () => this.logoutNow() }); return; }
    }
    this.logoutNow();
  },
  logoutNow() {
    if (save.data && save.live) save.write();
    save.live = false;   // 之后（包括关页面时的自动保存）不再写存档：下面要切回本机存档键，不能把账号角色写进本机存档（save.data 留着：跳转前 HUD 还会画几帧）
    net.api('POST', '/api/logout', {}, { noAuthReset: true }).catch(() => {});
    net.logoutLocal(); cloudSave.leave();
    location.href = location.pathname + location.search.replace(/[?&](town|dungeon)[^&]*/g, '');
  },
};
