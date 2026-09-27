/* =====================================================================
   登录界面：标题画面的“登录 / 注册 / 不登录直接玩”、登录 / 注册窗口、账号窗口（云存档状态、导入本机角色、改密码、登出）、系统菜单里的账号入口
   服务器不可用（离线单文件、静态托管没有 /api）时标题画面保持原样
   ===================================================================== */
const loginUserErr = n => !n ? '请输入用户名' : !/^[一-鿿A-Za-z0-9_]{2,16}$/.test(n) ? '用户名只能用 2~16 个汉字、字母、数字或下划线' : /^\d+$/.test(n) ? '用户名不能全是数字' : null;
const loginPassErr = p => !p || p.length < 6 ? '密码至少 6 位' : p.length > 64 ? '密码最多 64 位' : null;
const cloudStateText = () => {
  const C = cloudSave;
  if (!net.connected && C.state === 'offline') return ['离线（恢复网络后自动同步）', '#ffb08a'];
  if (C.state === 'conflict') return ['存档冲突，等待选择', '#ff8a6a'];
  if (C.busy) return ['同步中…', '#bfe8ff'];
  if (C.dirty) return ['有改动，稍后自动上传', '#ffe8a8'];
  if (C.lastSync) return [`已同步 ${new Date(C.lastSync).toLocaleTimeString('zh-CN', { hour12: false })}`, '#8aff9a'];
  return ['已连接', '#8aff9a'];
};
// 标题画面：在原来的标题上加账号区
const _wTitle = menus.w_title;
Object.assign(menus, {
  w_title(arg) {
    const el = _wTitle.call(this, arg);
    if (!net.canUse() || !net.probed || !net.avail) {
      if (net.canUse() && !net.probed && !this._probeHook) { this._probeHook = true; bus.on('netProbe', () => { if (net.avail && this.isOpen('title')) this.refresh('title'); }); }
      return el;
    }
    const goBtn = el.querySelector('.titlego'), col = goBtn && goBtn.parentElement;
    if (!col) return el;
    const origGo = el._onConfirm;
    if (netOn()) {
      // 已登录：进入游戏 = 账号的角色（等云存档核对完）
      const go = () => {
        if (account.syncing) { goBtn.textContent = '正在同步云存档…'; goBtn.classList.add('off'); account.syncing.finally(() => { goBtn.classList.remove('off'); goBtn.textContent = '进入游戏'; origGo(); }); return; }
        origGo();
      };
      goBtn.onclick = null; const nb = goBtn.cloneNode(true); nb.addEventListener('click', go); goBtn.replaceWith(nb); el._onConfirm = go;
      const [st, col2] = cloudStateText();
      col.insertBefore(h('div', { class: 'netacct' },
        h('span', {}, '账号 ', h('b', { class: 'gold' }, net.user.name), net.user.admin ? h('span', { class: 'small', style: 'color:#ff9a6a;margin-left:.3em' }, '管理员') : null),
        h('span', { class: 'small', style: `color:${col2}` }, '云存档 · ' + st),
        h('span', { class: 'row', style: 'gap:.5em' },
          h('button', { class: 'btn', onclick: () => { sfx.click(); this.show('account'); } }, '账号'),
          h('button', { class: 'btn blue', onclick: () => { sfx.click(); account.logout(); } }, '登出'))), nb.nextSibling);
    } else {
      // 未登录：登录 / 注册 / 不登录直接玩
      goBtn.textContent = '不登录直接玩'; goBtn.classList.add('blue', 'netsolo');
      const hint = goBtn.nextSibling;
      if (hint && hint.classList) hint.textContent = (hint.textContent || '') + '（只存在这台电脑上）';
      col.insertBefore(h('div', { class: 'row', style: 'gap:.8em' },
        h('button', { class: 'btn big netbig', onclick: () => { sfx.init(); sfx.click(); this.show('login', 'login'); } }, '登录'),
        h('button', { class: 'btn big netbig', onclick: () => { sfx.init(); sfx.click(); this.show('login', 'register'); } }, '注册')), goBtn);
      col.insertBefore(h('div', { class: 'small dim' }, '登录后：云存档 · 和好友同屏 · 组队刷图 · 好友决斗'), goBtn);
      el._onConfirm = () => { sfx.init(); this.show('login', 'login'); };
    }
    const foot = el.lastChild; if (foot && foot.lastChild && /本机浏览器/.test(foot.lastChild.textContent || '')) foot.lastChild.textContent = netOn() ? '进度保存在账号云存档（断网时先存在本机，恢复后自动同步）' : '不登录时进度只保存在本机浏览器';
    return el;
  },
  /* ---- 登录 / 注册 ---- */
  w_login(mode = 'login') {
    const reg = mode === 'register';
    const f = (ph, type = 'text', max = 16) => { const i = h('input', { class: 'txt', type, placeholder: ph, maxlength: max, autocomplete: type === 'password' ? (reg ? 'new-password' : 'current-password') : 'username', spellcheck: 'false' }); i.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); submit(); } else if (e.key === 'Escape') { e.preventDefault(); this.close('login'); } }); return i; };
    const user = f('用户名（2~16 个汉字 / 字母 / 数字）'), pass = f('密码（至少 6 位）', 'password', 64), pass2 = reg ? f('再输一遍密码', 'password', 64) : null, invite = reg ? f('邀请码（找房主要）', 'text', 40) : null;
    const msg = h('div', { class: 'askerr' }), btn = h('button', { class: 'btn big', onclick: () => submit() }, reg ? '注册并登录' : '登录');
    try { const last = localStorage.getItem('dawnbreak_lastuser'); if (last && !reg) user.value = last; } catch (e) { /* */ }
    let busy = false;
    const submit = async () => {
      if (busy) return;
      const u = user.value.trim(), p = pass.value;
      const e = loginUserErr(u) || (reg ? loginPassErr(p) : (!p ? '请输入密码' : null)) || (reg && p !== pass2.value ? '两次输入的密码不一样' : null) || (reg && !invite.value.trim() ? '请输入邀请码' : null);
      if (e) { msg.textContent = e; sfx.error(); return; }
      busy = true; btn.classList.add('off'); msg.style.color = '#bfe8ff'; msg.textContent = reg ? '正在注册…' : '正在登录…';
      try {
        const r = await net.api('POST', reg ? '/api/register' : '/api/login', reg ? { user: u, pass: p, invite: invite.value.trim() } : { user: u, pass: p });
        try { localStorage.setItem('dawnbreak_lastuser', u); } catch (e2) { /* */ }
        msg.textContent = '正在读取云存档…';
        await account.onLogin(r);
        this.close('login'); sfx.levelUp && sfx.levelUp();
        toastMsg(`欢迎，${r.user.name}！`, '#8aff9a');
        const next = () => { if (this.isOpen('title')) this.close('title'); if (!game.player) this.show('charselect'); };
        cloudSave.offerImport(next);
      } catch (er) {
        busy = false; btn.classList.remove('off'); msg.style.color = ''; msg.textContent = er.message || '出错了'; sfx.error();
      }
    };
    const swap = h('div', { class: 'small dim', style: 'text-align:center' }, reg ? '已经有账号了？' : '还没有账号？', h('a', { href: '#', class: 'gold', onclick: ev => { ev.preventDefault(); this.close('login'); this.show('login', reg ? 'login' : 'register'); } }, reg ? '去登录' : '注册一个'));
    const body = h('div', { class: 'col loginbd' }, user, pass, pass2, invite, msg, btn, swap,
      h('div', { class: 'small dim' }, '密码经过加密保存；登录状态保持 30 天。'));
    const el = this.win(reg ? '注册账号' : '登录', body, { w: 24, block: true, drag: false });
    el._onConfirm = submit;
    setTimeout(() => (user.value ? pass : user).focus(), 30);
    return el;
  },
  /* ---- 账号窗口 ---- */
  w_account() {
    if (!netOn()) return null;
    const box = h('div', { class: 'col', style: 'gap:.6em' });
    const draw = () => {
      const [st, col] = cloudStateText(), loc = cloudSave.localChars(), d = cloudSave.payload();
      box.replaceChildren(
        h('div', {}, '账号：', h('b', { class: 'gold' }, net.user.name), net.user.admin ? h('span', { class: 'small', style: 'color:#ff9a6a;margin-left:.4em' }, '管理员') : null),
        h('div', { class: 'small' }, `联机：${net.connected ? `在线（延迟 ${Math.round(net.rtt)} ms）` : '未连接（自动重连中）'}`),
        h('div', { class: 'small', style: `color:${col}` }, `云存档：${st}`),
        h('div', { class: 'small dim' }, `账号角色 ${(d.chars || []).length}/${MAX_CHARS}${cloudSave.lastSync ? ' · 上次同步 ' + new Date(cloudSave.lastSync).toLocaleString('zh-CN', { hour12: false }) : ''}`),
        h('div', { class: 'row', style: 'gap:.5em;flex-wrap:wrap' },
          h('button', { class: 'btn', onclick: () => { sfx.click(); if (save.data && save.live) save.write(); cloudSave.flush(true).then(ok => { toastMsg(ok ? '云存档已上传' : '上传失败：' + (cloudSave.err || '请检查网络'), ok ? '#8aff9a' : '#ff9a6a'); draw(); }); } }, '立即同步'),
          loc.length ? h('button', { class: 'btn', onclick: () => {
            sfx.click();
            if (game.player) { toastMsg('请先返回角色选择再导入本机角色', '#ffd0a0'); return; }
            menus.ask({ title: '导入本机角色', text: `把这台电脑上未登录时玩的 ${loc.length} 个角色（${loc.map(c => escHtml(c.name || '')).join('、')}）加到账号里？`, okText: '导入', ok: () => { const r = cloudSave.importLocal(); cloudSave.flush(); toastMsg(`已导入 ${r.n} 个角色${r.skipped ? `，${r.skipped} 个因角色位已满没有导入` : ''}`, '#8aff9a'); if (this.isOpen('charselect')) this.refresh('charselect'); draw(); } });
          } }, '导入本机角色') : null,
          h('button', { class: 'btn', onclick: () => { sfx.click(); this.show('passwd'); } }, '修改密码'),
          h('button', { class: 'btn red', onclick: () => { sfx.click(); account.logout(); } }, '登出')));
    };
    draw();
    const el = this.win('账号信息', box, { w: 26 });
    const iv = setInterval(() => { if (!el.isConnected) { clearInterval(iv); return; } draw(); }, 2000);
    return el;
  },
  w_passwd() {
    const f = ph => { const i = h('input', { class: 'txt', type: 'password', placeholder: ph, maxlength: 64, autocomplete: 'new-password' }); i.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') go(); }); return i; };
    const o = f('原密码'), n1 = f('新密码（至少 6 位）'), n2 = f('再输一遍新密码'), msg = h('div', { class: 'askerr' });
    const go = async () => {
      const e = loginPassErr(n1.value) || (n1.value !== n2.value ? '两次输入的新密码不一样' : null); if (e) { msg.textContent = e; return; }
      try { await net.api('POST', '/api/password', { old: o.value, pass: n1.value }); toastMsg('密码已修改', '#8aff9a'); this.close('passwd'); }
      catch (er) { msg.textContent = er.message; sfx.error(); }
    };
    return this.win('修改密码', h('div', { class: 'col loginbd' }, o, n1, n2, msg, h('button', { class: 'btn', onclick: go }, '确定')), { w: 22, block: true });
  },
});
// 系统菜单：账号信息 / 登出
const _wSystem = menus.w_system;
menus.w_system = function (arg) {
  const el = _wSystem.call(this, arg);
  if (!netOn()) return el;
  const col = el.querySelector('.sysmenu'); if (!col) return el;
  const last = col.lastChild;
  const B = (label, cls, fn) => h('button', { class: 'btn' + (cls ? ' ' + cls : ''), onclick: () => { sfx.click(); fn(); } }, label);
  col.insertBefore(B(`账号信息（${net.user.name}）`, '', () => { this.close('system'); this.show('account'); }), last);
  col.insertBefore(B('登出账号', '', () => { if (game.scene === 'dungeon') { toastMsg('地下城里不能登出，请先返回城镇', '#ffd0a0'); return; } this.close('system'); account.logout(); }), last);
  return el;
};
addStyle(`#title .netbig{font-size:1.5em;padding:.55em 2.2em}#title .titlego.netsolo{font-size:1.05em;padding:.45em 1.8em}
.netacct{display:flex;flex-direction:column;align-items:center;gap:.35em;padding:.5em 1.2em;border-radius:.4em;background:rgba(10,8,14,.55);border:.08em solid rgba(232,194,106,.3)}
.loginbd{gap:.55em;min-width:18em}.loginbd .txt{width:100%;box-sizing:border-box;font-size:1.05em;padding:.45em .6em}.loginbd .btn.big{margin-top:.2em}`);
account.boot();
